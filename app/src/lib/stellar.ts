import {
  rpc,
  Networks,
  Address,
  Contract,
  TransactionBuilder,
  Account,
  xdr,
} from "@stellar/stellar-sdk";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { Buffer } from "buffer";
import { generatePaymentProof, PaymentProofInputs } from "./zkp";
import { nativeToScVal } from '@stellar/stellar-sdk';

/**
 * Stellar Infrastructure Configuration
 */
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org:443";
export const rpcServer = new rpc.Server(RPC_URL);
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;

/**
 * Helper: Mengubah Hex String dari SnarkJS menjadi xdr.ScVal (BytesN)
 */
const hexToBytesN = (hexStr: string) => {
  return xdr.ScVal.scvBytes(Buffer.from(hexStr, "hex"));
};

/**
 * payWithZk
 * * ATOMIC SETTLEMENT LOGIC:
 * Men-generate bukti ZK di sisi klien, lalu memetakannya secara deterministik
 * ke format BytesN untuk diverifikasi oleh fungsi Protocol 25 di Soroban.
 */
export const payWithZk = async (to: string, amount: bigint, inputs: PaymentProofInputs) => {
  if (!(await isConnected())) throw new Error("Freighter wallet not found.");

  // 1. Get User Address & Account Sequence
  const { address: from } = await requestAccess();
  if (!from) throw new Error("User rejected access.");

  const accountResponse = await rpcServer.getAccount(from);

  /**
   * STEP 2: ZK-PROOF GENERATION (Client-Side)
   */
  console.log("🛠️ [ZKP] Generating Groth16 Proof locally...");
  const proof = await generatePaymentProof(
    inputs,
    "/circuit/fluppy_payment.wasm",
    "/circuit/circuit_final.zkey"
  );

  /**
   * STEP 3: XDR MAPPING (Deterministic BytesN mapping)
   * Menyusun argumen secara ketat sesuai dengan urutan fungsi di `lib.rs`:
   * pay_with_zk(env, from, to, amount, pi_a, pi_b, pi_c, nullifier, merkle_root, recipient_hash, min_amount, max_amount)
   */
  console.log("🔄 [Stellar] Mapping ZK Points to Soroban XDR...");
  
  const contractArgs = [
    new Address(from).toScVal(),                                // 1. from
    new Address(to).toScVal(),                                  // 2. to
    nativeToScVal(amount, { type: "i128" }),                    // 3. amount
    hexToBytesN(proof.pi_a),                                    // 4. pi_a (64 bytes)
    hexToBytesN(proof.pi_b),                                    // 5. pi_b (128 bytes)
    hexToBytesN(proof.pi_c),                                    // 6. pi_c (64 bytes)
    hexToBytesN(proof.publicSignals[0]),                        // 7. nullifier
    hexToBytesN(proof.publicSignals[2]),                        // 8. merkle_root (Index 2)
    hexToBytesN(proof.publicSignals[3]),                        // 9. recipient_hash
    hexToBytesN(proof.publicSignals[4]),                        // 10. min_amount
    hexToBytesN(proof.publicSignals[5]),                        // 11. max_amount
  ];

  // 3b. Build Transaction
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(
    new Account(from, accountResponse.sequenceNumber()),
    {
      fee: "100000", // Sedikit dinaikkan karena transaksi ZK butuh lebih banyak byte
      networkPassphrase: NETWORK_PASSPHRASE
    }
  )
    .addOperation(
      contract.call("pay_with_zk", ...contractArgs)
    )
    .setTimeout(30)
    .build();

  /**
   * STEP 4: SIMULATION & SIGNING
   */
  console.log("⚙️ [Stellar] Simulating transaction...");
  const preparedTx = await rpcServer.prepareTransaction(tx);

  console.log("✍️ [Stellar] Awaiting Freighter signature...");
  const signResult = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE
  });

  if (signResult.error) throw new Error(signResult.error);

  /**
   * STEP 5: SUBMISSION
   */
  console.log("🚀 Submitting to Network...");
  const submission = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signResult.signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (submission.status === "ERROR") {
    console.error("Submission Error:", submission);
    throw new Error("RPC Submission Failed. Cek parameter XDR.");
  }

  return await pollTransaction(submission.hash);
};

/**
 * pollTransaction
 * Monitors the transaction status until it's finalized in the ledger.
 */
export const pollTransaction = async (hash: string) => {
  let status = "PENDING";
  let txStatus: any;

  while (status === "PENDING" || status === "NOT_FOUND") {
    txStatus = await rpcServer.getTransaction(hash);
    status = txStatus.status;

    if (status === "SUCCESS") return txStatus;

    if (status === "FAILED") {
      console.error("TX Failure Metadata:", txStatus.resultMetaXdr || txStatus.resultXdr);
      throw new Error("Transaction rejected by Soroban VM.");
    }

    // 2-second delay to avoid rate-limiting
    await new Promise((r) => setTimeout(r, 2000));
  }
  return txStatus;
};