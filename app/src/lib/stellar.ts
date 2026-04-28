import {
  rpc,
  Networks,
  Address,
  Contract,
  TransactionBuilder,
  Account,
  xdr,
  Keypair,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

/**
 * CONFIGURATION
 */
const getRpcUrl = () => process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org:443";
const getNetworkPassphrase = () => process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;

// Kita biarkan ini sebagai export, tapi beri fallback atau check di dalam fungsi
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;

/**
 * Helper: Convert Hex String to Soroban ScVal (Bytes/BytesN)
 */
const hexToScVal = (hexStr: string) => {
  return xdr.ScVal.scvBytes(Buffer.from(hexStr, "hex"));
};

export const payWithZk = async (merchant: string, amount: bigint, proof: any) => {
  // --- VALIDASI CONTRACT ID ---
  const currentContractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
  console.log("🔍 [Debug] Using Contract ID:", currentContractId);

  if (!currentContractId) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ID is not defined. Check your .env file.");
  }

  const rpcServer = new rpc.Server(getRpcUrl());
  const networkPassphrase = getNetworkPassphrase();
  
  let senderAddress: string;
  let isBrowser = typeof window !== "undefined";

  // 1. Identify Sender & Auth Method
  if (isBrowser) {
    const { isConnected, requestAccess } = await import("@stellar/freighter-api");
    if (!(await isConnected())) throw new Error("Freighter wallet not found.");
    const { address } = await requestAccess();
    if (!address) throw new Error("User rejected access.");
    senderAddress = address;
  } else {
    if (!process.env.SENDER_SECRET) throw new Error("SENDER_SECRET missing in .env");
    const sourceKeypair = Keypair.fromSecret(process.env.SENDER_SECRET);
    senderAddress = sourceKeypair.publicKey();
  }

  const accountResponse = await rpcServer.getAccount(senderAddress);

  /**
   * STEP 2: XDR MAPPING
   */
  console.log("🔄 [Stellar] Mapping ZK Payload to Soroban XDR...");

  const publicInputsVec = xdr.ScVal.scvVec(
    proof.publicSignals.map((sig: string) => hexToScVal(sig))
  );

  // Gunakan nativeToScVal untuk address agar lebih aman dari error "Unsupported address type"
  const contractArgs = [
    nativeToScVal(senderAddress, { type: "address" }), // 1. sender
    nativeToScVal(merchant, { type: "address" }),      // 2. merchant
    nativeToScVal(amount, { type: "i128" }),           // 3. amount
    hexToScVal(proof.pi_a),                            // 4. pi_a
    hexToScVal(proof.pi_b),                            // 5. pi_b
    hexToScVal(proof.pi_c),                            // 6. pi_c
    publicInputsVec,                                   // 7. public_inputs
  ];

  // 3. Build Transaction
  const contract = new Contract(currentContractId);
  const tx = new TransactionBuilder(
    new Account(senderAddress, accountResponse.sequenceNumber()),
    {
      fee: "100000",
      networkPassphrase: networkPassphrase
    }
  )
    .addOperation(contract.call("execute_payment", ...contractArgs))
    .setTimeout(30)
    .build();

  /**
   * STEP 4: PREPARE & SIGN
   */
  console.log("⚙️ [Stellar] Simulating transaction...");
  const preparedTx = await rpcServer.prepareTransaction(tx);

  let signedTx;
  if (isBrowser) {
    const { signTransaction } = await import("@stellar/freighter-api");
    console.log("✍️ [Stellar] Awaiting Freighter signature...");
    const signResult = await signTransaction(preparedTx.toXDR(), {
      networkPassphrase: networkPassphrase
    });
    if (signResult.error) throw new Error(signResult.error);
    signedTx = TransactionBuilder.fromXDR(signResult.signedTxXdr, networkPassphrase);
  } else {
    const sourceKeypair = Keypair.fromSecret(process.env.SENDER_SECRET!);
    preparedTx.sign(sourceKeypair);
    signedTx = preparedTx;
  }

  /**
   * STEP 5: SUBMISSION
   */
  console.log("🚀 Submitting to Testnet...");
  const submission = await rpcServer.sendTransaction(signedTx);

  if (submission.status === "ERROR") {
    // Mencoba mengambil detail error dari hasil simulasi jika ada
    throw new Error(`RPC Submission Failed: ${JSON.stringify(submission.errorResult || submission)}`);
  }

  return await pollTransaction(submission.hash, rpcServer);
};

export const pollTransaction = async (hash: string, server: rpc.Server) => {
  let status = "PENDING";
  let txStatus: any;

  while (status === "PENDING" || status === "NOT_FOUND") {
    txStatus = await server.getTransaction(hash);
    status = txStatus.status;
    if (status === "SUCCESS") return txStatus;
    if (status === "FAILED") {
        console.log("❌ Transaction Result XDR:", txStatus.resultXdr);
        throw new Error("Transaction rejected by Soroban VM. Check contract constraints.");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return txStatus;
};