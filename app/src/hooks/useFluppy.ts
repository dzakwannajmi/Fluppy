import { useState } from "react";
import { requestAccess, signTransaction } from "@stellar/freighter-api";
import { TransactionBuilder, Contract, nativeToScVal, Address, xdr } from "@stellar/stellar-sdk";
import { generateZKP } from "../lib/zkp";
import {
    rpcServer,
    pollTransaction,
    NETWORK_PASSPHRASE,
    DEV_OPS_WALLET,
    USDC_ID,
    CONTRACT_ID
} from "../lib/stellar";

export const useFluppy = () => {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);

    const connectWallet = async () => {
        try {
            const access = await requestAccess();
            if (access.address) setWalletAddress(access.address);
        } catch (e) {
            console.error("Wallet connection failed", e);
        }
    };

    const executePayment = async (amount: string, hotelWallet: string) => {
        if (!walletAddress) return;
        setLoading(true);

        try {
            // 1. Generate ZKP (James NIM)
            const { leaf, proof, root } = generateZKP("2410010454");

            // 2. Mapping Data ke format Soroban
            const configScVal = xdr.ScVal.scvMap([
                new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("dev_ops"), val: new Address(DEV_OPS_WALLET).toScVal() }),
                new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("fee_percentage"), val: nativeToScVal(BigInt(500), { type: "i128" }) }),
                new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("usdc_token"), val: new Address(USDC_ID).toScVal() })
            ]);

            const zkProofScVal = xdr.ScVal.scvMap([
                new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("leaf"), val: nativeToScVal(leaf, { type: "bytes" }) }),
                new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("proof"), val: nativeToScVal(proof, { type: "bytes" }) }),
                new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("root"), val: nativeToScVal(root, { type: "bytes" }) })
            ]);

            // 3. Setup Kontrak & Akun
            const account = await rpcServer.getAccount(walletAddress);
            const contract = new Contract(CONTRACT_ID);
            const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10000000));

            // 4. Build Transaction
            const tx = new TransactionBuilder(account, {
                fee: "10000",
                networkPassphrase: NETWORK_PASSPHRASE
            })
            .addOperation(contract.call(
                "pay_with_zk",
                configScVal,
                new Address(walletAddress).toScVal(),
                new Address(hotelWallet).toScVal(),
                nativeToScVal(rawAmount, { type: "i128" }),
                zkProofScVal
            ))
            .setTimeout(30)
            .build();

            // 5. Prepare & Sign
            const prepared = await rpcServer.prepareTransaction(tx);
            const signed = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });

            if (signed.error) throw new Error(signed.error);

            // 6. Send & Poll
            const res = await rpcServer.sendTransaction(
                TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE)
            );

            if ((res.status as string) === "ERROR") {
                throw new Error("RPC ditolak. Cek saldo atau status Pause.");
            }

            console.log("Tx Sent! Hash:", res.hash);
            await pollTransaction(res.hash);

            setTxHash(res.hash);
            return res.hash;

        } catch (err: any) {
            console.error("DETAILED ERROR:", err);
            if (err.message?.includes("Error(Contract, #3)")) {
                alert("⚠️ Sistem sedang MAINTENANCE (Paused by Admin).");
            } else {
                alert(`Gagal: ${err.message || "Kesalahan Blockchain"}`);
            }
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { walletAddress, loading, txHash, connectWallet, executePayment };
};