/**
 * lib/stellar.ts — Fluppy Soroban Transaction Layer
 *
 * Responsibilities:
 *   - Serialise Groth16 ZK proof to Soroban XDR format
 *   - Submit transactions to Stellar Testnet via Freighter
 *   - Poll transaction status until finalised
 *
 * Contract function invoked: execute_payment()
 * Rust signature:
 *   pub fn execute_payment(
 *     env:           Env,
 *     from:          Address,
 *     to:            Address,
 *     amount:        i128,
 *     pi_a:          Bytes,           // 64 bytes  — G1 point
 *     pi_b:          Bytes,           // 128 bytes — G2 point
 *     pi_c:          Bytes,           // 64 bytes  — G1 point
 *     public_inputs: Vec<BytesN<32>>, // 6 × 32 bytes
 *   ) -> Result<(), FluppyError>
 */

import {
  rpc,
  Networks,
  Contract,
  TransactionBuilder,
  Account,
  xdr,
  Keypair,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import type { PaymentProofOutput } from "./zkp";

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const getRpcUrl = () =>
  process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org:443";

const getNetworkPassphrase = () =>
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;

function getContractId(): string {
  const id = process.env.NEXT_PUBLIC_CONTRACT_ID;
  if (!id) throw new Error("[Stellar] NEXT_PUBLIC_CONTRACT_ID not found in .env");
  return id;
}

// ─────────────────────────────────────────────────────────────
// ENCODING CONSTANTS
//
// Byte lengths must match the corresponding BytesN<N> types in
// the Rust contract. A mismatch causes the Soroban VM to reject
// the transaction with an opaque XDR error.
// ─────────────────────────────────────────────────────────────

/** G1 affine point: x_be32 ‖ y_be32 = 64 bytes (pi_a and pi_c) */
const G1_BYTE_LENGTH = 64;

/**
 * G2 affine point: x_c1_be32 ‖ x_c0_be32 ‖ y_c1_be32 ‖ y_c0_be32 = 128 bytes (pi_b)
 *
 * Fq2 coordinate ordering:
 *   SnarkJS output: [[x_c1, x_c0], [y_c1, y_c0]]
 *   encodeG2() in zkp.ts preserves this order (imaginary before real)
 *   Consistent with EIP-197 and Soroban bn254_pairing_check
 */
const G2_BYTE_LENGTH = 128;

/** BN254 scalar field element: 32 bytes big-endian (one public signal) */
const FIELD_BYTE_LENGTH = 32;

/** Must match N_PUBLIC in zkp.ts and the Circom circuit */
const N_PUBLIC = 7;

// ─────────────────────────────────────────────────────────────
// HELPERS — XDR Serialisation
// ─────────────────────────────────────────────────────────────

/**
 * Convert a hex string to a Soroban scvBytes ScVal.
 *
 * @param hexStr        - Even-length hex string
 * @param expectedBytes - Optional byte-length validation
 */
function hexToScBytes(hexStr: string, expectedBytes?: number): xdr.ScVal {
  if (hexStr.length % 2 !== 0) {
    throw new Error(
      `[Stellar] hexToScBytes: odd-length hex string (${hexStr.length} chars). ` +
      `Verify that encodeG1/encodeG2 in zkp.ts produces well-formed hex.`
    );
  }

  const actualBytes = hexStr.length / 2;

  if (expectedBytes !== undefined && actualBytes !== expectedBytes) {
    throw new Error(
      `[Stellar] Byte length mismatch: ` +
      `expected ${expectedBytes} bytes, received ${actualBytes} bytes ` +
      `(${hexStr.length} hex chars). ` +
      `Review encodeG1/encodeG2 in zkp.ts.`
    );
  }

  return xdr.ScVal.scvBytes(Buffer.from(hexStr, "hex"));
}

/**
 * Validate the full Groth16 proof before submission.
 * Fails fast with a descriptive message rather than an opaque Soroban VM error.
 */
function validateGroth16Proof(proof: PaymentProofOutput): void {
  const errors: string[] = [];

  if (proof.pi_a.length !== G1_BYTE_LENGTH * 2) {
    errors.push(
      `pi_a: expected ${G1_BYTE_LENGTH * 2} hex chars (${G1_BYTE_LENGTH} bytes), ` +
      `received ${proof.pi_a.length}`
    );
  }
  if (proof.pi_b.length !== G2_BYTE_LENGTH * 2) {
    errors.push(
      `pi_b: expected ${G2_BYTE_LENGTH * 2} hex chars (${G2_BYTE_LENGTH} bytes), ` +
      `received ${proof.pi_b.length}`
    );
  }
  if (proof.pi_c.length !== G1_BYTE_LENGTH * 2) {
    errors.push(
      `pi_c: expected ${G1_BYTE_LENGTH * 2} hex chars (${G1_BYTE_LENGTH} bytes), ` +
      `received ${proof.pi_c.length}`
    );
  }
  if (proof.publicSignals.length !== N_PUBLIC) {
    errors.push(
      `publicSignals: expected ${N_PUBLIC} elements, received ${proof.publicSignals.length}`
    );
  } else {
    proof.publicSignals.forEach((sig, i) => {
      if (sig.length !== FIELD_BYTE_LENGTH * 2) {
        errors.push(
          `publicSignals[${i}]: expected ${FIELD_BYTE_LENGTH * 2} hex chars, ` +
          `received ${sig.length}`
        );
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(
      `[Stellar] Proof validation failed:\n  - ${errors.join("\n  - ")}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SENDER RESOLUTION
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the transaction sender address.
 * Browser:  via Freighter wallet extension
 * Node.js:  via SENDER_SECRET in .env (for test scripts)
 */
async function resolveSender(): Promise<{ address: string; isBrowser: boolean }> {
  const isBrowser = typeof window !== "undefined";

  if (isBrowser) {
    const { isConnected, requestAccess } = await import("@stellar/freighter-api");

    const connected = await isConnected();
    if (!connected.isConnected) {
      throw new Error(
        "[Stellar] Freighter wallet not found. " +
        "Install the Freighter extension from freighter.app"
      );
    }

    const { address, error } = await requestAccess();
    if (error) throw new Error(`[Stellar] Freighter access denied: ${error}`);
    if (!address) throw new Error("[Stellar] Freighter returned no address.");

    return { address, isBrowser: true };
  } else {
    // Node.js mode — for testing / scripting
    if (!process.env.SENDER_SECRET) {
      throw new Error("[Stellar] SENDER_SECRET is missing from .env (required in Node.js mode)");
    }
    return {
      address: Keypair.fromSecret(process.env.SENDER_SECRET).publicKey(),
      isBrowser: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// SIGN & SUBMIT
// ─────────────────────────────────────────────────────────────

async function signAndSubmit(
  preparedTx: any,
  isBrowser: boolean,
  networkPassphrase: string,
  rpcServer: rpc.Server,
): Promise<any> {
  let signedTx;

  if (isBrowser) {
    const { signTransaction } = await import("@stellar/freighter-api");
    console.log("[Stellar] Awaiting Freighter signature...");

    const signResult = await signTransaction(preparedTx.toXDR(), { networkPassphrase });

    if (signResult.error) {
      throw new Error(`[Stellar] Freighter rejected signing: ${signResult.error}`);
    }

    signedTx = TransactionBuilder.fromXDR(signResult.signedTxXdr, networkPassphrase);
  } else {
    const sourceKeypair = Keypair.fromSecret(process.env.SENDER_SECRET!);
    preparedTx.sign(sourceKeypair);
    signedTx = preparedTx;
  }

  console.log("[Stellar] Submitting transaction to the network...");
  const submission = await rpcServer.sendTransaction(signedTx);

  if (submission.status === "ERROR") {
    throw new Error(
      `[Stellar] RPC submission failed: ` +
      `${JSON.stringify(submission.errorResult ?? submission)}`
    );
  }

  return await pollTransaction(submission.hash, rpcServer);
}

// ─────────────────────────────────────────────────────────────
// PUBLIC EXPORT: payWithZkGroth16
//
// Invokes: execute_payment(from, to, amount, pi_a, pi_b, pi_c, public_inputs)
//
// Argument order MUST match the Rust declaration in lib.rs exactly:
//   1. from           → Address
//   2. to             → Address
//   3. amount         → i128
//   4. pi_a           → Bytes (64 bytes)
//   5. pi_b           → Bytes (128 bytes)
//   6. pi_c           → Bytes (64 bytes)
//   7. public_inputs  → Vec<BytesN<32>> (6 × 32 bytes)
// ─────────────────────────────────────────────────────────────

export const payWithZkGroth16 = async (
  merchant: string,
  amount: bigint,
  proof: PaymentProofOutput,
): Promise<any> => {
  const contractId = getContractId();
  const networkPassphrase = getNetworkPassphrase();
  const rpcServer = new rpc.Server(getRpcUrl());

  console.log("[Stellar] payWithZkGroth16 — Contract:", contractId.slice(0, 8) + "...");

  // ── Pre-flight validation ──────────────────────────────────────────────────
  // Validate byte lengths before building the transaction.
  // Failing here produces a clear error; the VM produces an opaque XDR fault.
  validateGroth16Proof(proof);

  const { address: senderAddress, isBrowser } = await resolveSender();
  const accountResponse = await rpcServer.getAccount(senderAddress);

  // ── Proof serialisation to ScVal ──────────────────────────────────────────

  /**
   * pi_a — G1 affine point, 64 bytes
   * Layout: x_be32 (32 bytes) ‖ y_be32 (32 bytes)
   * Rust type: Bytes (BytesN<64>)
   */
  const piAScVal = hexToScBytes(proof.pi_a, G1_BYTE_LENGTH);

  /**
   * pi_b — G2 affine point, 128 bytes
   * Layout: x_c1_be32 ‖ x_c0_be32 ‖ y_c1_be32 ‖ y_c0_be32
   * Rust type: Bytes (BytesN<128>)
   *
   * SnarkJS reversal: pi_b[0] = [x_c1, x_c0] — imaginary component first
   * Already handled by encodeG2() in zkp.ts
   */
  const piBScVal = hexToScBytes(proof.pi_b, G2_BYTE_LENGTH);

  /**
   * pi_c — G1 affine point, 64 bytes
   * Layout: x_be32 ‖ y_be32
   * Rust type: Bytes (BytesN<64>)
   */
  const piCScVal = hexToScBytes(proof.pi_c, G1_BYTE_LENGTH);

  /**
   * public_inputs — Vec<BytesN<32>> in Rust
   * 6 field elements, each 32 bytes big-endian
   * Serialised as: scvVec([scvBytes(32), scvBytes(32), ...])
   *
   * Ordering (must match the circuit):
   *   [0] nullifier       ← circuit output
   *   [1] verifiedRoot    ← circuit output
   *   [2] merkleRoot      ← public input
   *   [3] recipientHash   ← public input
   *   [4] minAmount       ← public input
   *   [5] maxAmount       ← public input
   */
  const publicInputsScVal = xdr.ScVal.scvVec(
    proof.publicSignals.map(sig => hexToScBytes(sig, FIELD_BYTE_LENGTH))
  );

  // ── Build transaction ──────────────────────────────────────────────────────
  const contractArgs = [
    nativeToScVal(senderAddress, { type: "address" }), // 1. from
    nativeToScVal(merchant, { type: "address" }),       // 2. to
    nativeToScVal(amount, { type: "i128" }),            // 3. amount (stroops)
    piAScVal,                                           // 4. pi_a
    piBScVal,                                           // 5. pi_b
    piCScVal,                                           // 6. pi_c
    publicInputsScVal,                                  // 7. public_inputs
  ];

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(
    new Account(senderAddress, accountResponse.sequenceNumber()),
    { fee: "100000", networkPassphrase },
  )
    .addOperation(contract.call("execute_payment", ...contractArgs))
    .setTimeout(300)
    .build();

  // ── Simulate & submit ──────────────────────────────────────────────────────
  console.log("[Stellar] Simulating transaction...");
  const preparedTx = await rpcServer.prepareTransaction(tx);

  return await signAndSubmit(preparedTx, isBrowser, networkPassphrase, rpcServer);
};

export async function getContractMerkleRoot(): Promise<string> {

  const response = await fetch('/api/merkle-root', { method: 'GET' });

  if (!response.ok) {
    throw new Error('Failed to fetch contract Merkle root');
  }

  const data = await response.json();

  if (!data.root) {
    throw new Error('Invalid merkle root response');
  }

  return String(data.root);
}

// ─────────────────────────────────────────────────────────────
// POLLING
// ─────────────────────────────────────────────────────────────

/**
 * Poll transaction status until finalised.
 * Soroban does not confirm synchronously — polling is required.
 *
 * Statuses:
 *   PENDING   → still processing
 *   NOT_FOUND → not yet in the ledger (retry)
 *   SUCCESS   → confirmed ✓
 *   FAILED    → rejected by the VM ✗
 */
export const pollTransaction = async (
  hash: string,
  server: rpc.Server,
): Promise<any> => {
  let status = "PENDING";
  let txStatus: any;
  let attempts = 0;
  const MAX_ATTEMPTS = 30; // ~60 second timeout

  console.log(`[Stellar] Polling transaction: ${hash.slice(0, 10)}...`);

  while (status === "PENDING" || status === "NOT_FOUND") {
    if (attempts >= MAX_ATTEMPTS) {
      throw new Error(
        `[Stellar] Transaction timed out after ${MAX_ATTEMPTS} attempts. ` +
        `Hash: ${hash}`
      );
    }

    txStatus = await server.getTransaction(hash);
    status = txStatus.status;
    attempts++;

    if (status === "SUCCESS") {
      console.log(`[Stellar] ✓ Transaction confirmed (attempt ${attempts})`);
      return txStatus;
    }

    if (status === "FAILED") {
      console.error("[Stellar] Transaction rejected. Result XDR:", txStatus.resultXdr);
      throw new Error(
        "Transaction rejected by the Soroban VM. " +
        "Possible causes: invalid proof, nullifier already spent, " +
        "or merkle root mismatch."
      );
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  return txStatus;
};