import {
  rpc,
  Networks,
  Address,
  Contract,
  TransactionBuilder,
  Account,
  xdr,
  nativeToScVal
} from "@stellar/stellar-sdk";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { Buffer } from "buffer";
import { ZKProof } from "./zkp";

/**
 * Stellar Infrastructure Configuration
 */
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org:443";
export const rpcServer = new rpc.Server(RPC_URL);
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;

/**
 * payWithZk
 * * ATOMIC SETTLEMENT LOGIC:
 * Handles the conversion of ZK-Proof points into Soroban-compatible 
 * BN254 Affine structures (64-byte for G1, 128-byte for G2).
 */
export const payWithZk = async (to: string, amount: bigint, zkProof: ZKProof) => {
  if (!(await isConnected())) throw new Error("Freighter wallet not found.");

  // 1. Get User Address & Account Sequence
  const { address: from } = await requestAccess();
  if (!from) throw new Error("User rejected access.");

  const accountResponse = await rpcServer.getAccount(from);

  /**
   * STEP 2: BN254 POINT MAPPING (Protocol 25)
   * Soroban expects concatenated bytes for Affine points.
   */
  console.log("Mapping ZK Points to Soroban XDR...");

  // G1 Mapping: Pastikan kita tidak mengambil 'number' tunggal
  const g1PointsScVal = xdr.ScVal.scvVec(
    (zkProof.g1_points as any[]).map((p: any) => {
      // Pastikan data adalah Buffer/Uint8Array, bukan number
      const x = p.x instanceof Uint8Array ? p.x : Buffer.from(p.x || []);
      const y = p.y instanceof Uint8Array ? p.y : Buffer.from(p.y || []);

      return xdr.ScVal.scvBytes(Buffer.concat([x, y]));
    })
  );

  // G2 Mapping
  const g2PointsScVal = xdr.ScVal.scvVec(
    (zkProof.g2_points as any[]).map((p: any) => {
      const xa = p.x?.a || p[0];
      const xb = p.x?.b || p[1];
      const ya = p.y?.a || p[2];
      const yb = p.y?.b || p[3];

      // Konversi semua ke Buffer sebelum digabung
      return xdr.ScVal.scvBytes(Buffer.concat([
        Buffer.from(xa), Buffer.from(xb),
        Buffer.from(ya), Buffer.from(yb)
      ]));
    })
  );

  // 3. Build Transaction
  const contract = new Contract(CONTRACT_ID);

  // We wrap the ZK data into a Map/Struct as expected by the contract
  const zkDataScVal = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("g1_points"),
      val: g1PointsScVal
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("g2_points"),
      val: g2PointsScVal
    })
  ]);

  const tx = new TransactionBuilder(
    new Account(from, accountResponse.sequenceNumber()),
    {
      fee: "10000",
      networkPassphrase: NETWORK_PASSPHRASE
    }
  )
    .addOperation(
      contract.call(
        "pay_with_zk",
        new Address(from).toScVal(),
        new Address(to).toScVal(),
        nativeToScVal(amount, { type: "i128" }),
        zkDataScVal
      )
    )
    .setTimeout(30)
    .build();

  /**
   * STEP 4: SIMULATION & SIGNING
   */
  console.log("🛠️ [Stellar] Simulating transaction...");
  const preparedTx = await rpcServer.prepareTransaction(tx);

  console.log("✍️ [Stellar] Awaiting Freighter signature...");
  const signResult = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE
  });

  if (signResult.error) throw new Error(signResult.error);

  /**
   * STEP 5: SUBMISSION
   */
  console.log("Submitting to Network...");
  const submission = await rpcServer.sendTransaction(
    TransactionBuilder.fromXDR(signResult.signedTxXdr, NETWORK_PASSPHRASE)
  );

  if (submission.status === "ERROR") {
    console.error("Submission Error:", submission);
    throw new Error("RPC Submission Failed.");
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