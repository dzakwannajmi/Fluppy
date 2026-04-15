import { rpc, Horizon, Networks } from "@stellar/stellar-sdk";

// 1. Ambil URL dari ENV atau gunakan default Testnet
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org:443";
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

// 2. Inisialisasi Server (Singleton)
export const rpcServer = new rpc.Server(RPC_URL);
export const horizonServer = new Horizon.Server(HORIZON_URL);

// 3. Network Passphrase (Testnet)
export const NETWORK_PASSPHRASE = Networks.TESTNET;

// 4. Constants for Contract IDs
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;
export const DEV_OPS_WALLET = process.env.NEXT_PUBLIC_DEV_OPS_WALLET!;
export const USDC_ID = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID!;

/**
 * Helper untuk mengecek status transaksi terbaru di Soroban
 */
export const pollTransaction = async (hash: string) => {
  let status = "PENDING";
  while (status !== "SUCCESS") {
    const txStatus = await rpcServer.getTransaction(hash);
    status = txStatus.status;
    
    if (status === "SUCCESS") return txStatus;
    if (status === "FAILED") throw new Error("Transaksi ditolak oleh Network.");
    
    // Tunggu 2 detik sebelum polling lagi agar tidak rate-limit
    await new Promise((r) => setTimeout(r, 2000));
  }
};