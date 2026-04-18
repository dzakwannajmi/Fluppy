import { rpc, Horizon, Networks } from "@stellar/stellar-sdk";

/**
 * Stellar Infrastructure Configuration
 * * We use a dual-server approach:
 * 1. RPC Server: For Soroban Smart Contract interaction (State, Simulation, and Submission).
 * 2. Horizon Server: For traditional Stellar ledger data (Trustlines, Balances).
 */

// 1. Fetch URLs from Environment Variables for security and environment flexibility
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org:443";
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

// 2. Server Initialization (Singleton Pattern)
// These instances are reused throughout the app to maintain efficient connection pooling.
export const rpcServer = new rpc.Server(RPC_URL);
export const horizonServer = new Horizon.Server(HORIZON_URL);

// 3. Network Passphrase (Targeting Stellar Testnet)
export const NETWORK_PASSPHRASE = Networks.TESTNET;

// 4. Immutable Constants for Deployment IDs
// Anchoring the protocol to specific contract instances and assets.
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;
export const DEV_OPS_WALLET = process.env.NEXT_PUBLIC_DEV_OPS_WALLET!;
export const USDC_ID = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID!;

/**
 * pollTransaction
 * * A robust polling mechanism to monitor transaction status until ledger finality.
 * This ensures the frontend waits for cryptographic confirmation before updating the UI state.
 * * @param hash - The transaction hash returned by the Soroban RPC.
 * @returns txStatus - The final status and metadata of the transaction.
 */
export const pollTransaction = async (hash: string) => {
  let status = "PENDING";
  
  // Polling loop with exponential backoff strategy (simplified)
  while (status !== "SUCCESS") {
    const txStatus = await rpcServer.getTransaction(hash);
    status = txStatus.status;
    
    if (status === "SUCCESS") return txStatus;
    
    // Explicit error handling for network rejection
    if (status === "FAILED") throw new Error("Transaction rejected by the Network.");
    
    // 2-second delay to prevent rate-limiting (429 errors) and optimize RPC usage
    await new Promise((r) => setTimeout(r, 2000));
  }
};