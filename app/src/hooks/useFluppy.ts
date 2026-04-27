// src/hooks/useFluppy.ts
'use client';

import { useState, useCallback } from "react";
import { requestAccess } from "@stellar/freighter-api";
import { generateZkProof } from "../lib/zkp";
import { parseContractError } from '../lib/errorMapper';
import { toast } from 'react-hot-toast';
import { payWithZk } from "../lib/stellar";

/**
 * AUTHORIZED WHITELIST (NIM List)
 * Order MUST be consistent with the Merkle Tree generated during setup.
 */
const WHITELIST = [
    "2410010454",
    "2410010001",
    "2410010002",
    "2410010003",
];

export const useFluppy = () => {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString([], {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
    }, []);

    const connectWallet = async () => {
        try {
            const access = await requestAccess();
            if (access.address) {
                setWalletAddress(access.address);
                addLog(`Wallet linked: ${access.address.slice(0, 6)}...${access.address.slice(-4)}`);
                toast.success("Wallet Connected");
            }
        } catch (err) {
            addLog("ERR: Connection failed.");
            toast.error("Freighter connection failed.");
        }
    };

    /**
     * executePayment
     * Orchestrates: ZK Proof Generation -> Soroban Transaction
     */
    const executePayment = async (amount: string, hotelWallet: string, nimSecret: string) => {
        if (!walletAddress) {
            toast.error("Please connect wallet first");
            return;
        }

        if (!nimSecret || nimSecret.trim() === '') {
            toast.error("NIM/Secret ID is required");
            addLog("❌ ERROR: Identity secret is missing.");
            return;
        }

        setLoading(true);
        setTxHash(null);
        setLogs([]);

        try {
            addLog("System: Starting Privacy-Preserving Settlement...");

            /**
             * STEP 1: ZK Proof Generation
             * We pass 'hotelWallet' to generateZkProof so it can compute the 
             * recipientHash (public signal) required by the circuit & contract.
             */
            addLog("ZKP: Initiating SnarkJS Groth16 worker...");
            addLog("ZKP: Computing Merkle Witness for identity...");

            // Pass hotelWallet as the 3rd argument for recipient integrity
            const zkProof = await generateZkProof(nimSecret, WHITELIST, hotelWallet);

            addLog("ZKP: Proof generated. Nullifier & Roots extracted.");

            // Convert amount to Stroops (7 decimals for USDC)
            const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10_000_000));
            addLog(`Finance: Scaling amount to ${rawAmount} stroops (USDC:7).`);

            /**
             * STEP 2: Submit to Stellar Soroban Contract
             */
            addLog("Stellar: Preparing XDR for Contract ID: " + process.env.NEXT_PUBLIC_CONTRACT_ID?.slice(0, 8) + "...");
            toast.loading("Awaiting Freighter Signature...", { id: "tx-process" });

            // The 'payWithZk' function should use process.env internally
            const finalResult = await payWithZk(hotelWallet, rawAmount, zkProof) as any;

            if (finalResult && (finalResult.status === "SUCCESS" || finalResult.status === "txSuccess")) {
                const hashToDisplay = finalResult.txHash || finalResult.hash;
                setTxHash(hashToDisplay);
                addLog(`✓ SUCCESS: Transaction Confirmed on Testnet.`);
                addLog(`Hash: ${hashToDisplay}`);
                toast.success("ZK Payment Successful!", { id: "tx-process" });
            } else {
                throw new Error(finalResult?.status || "Unknown transaction error");
            }

        } catch (err: unknown) {
            // Error mapping from Contract Error Codes (like #6) to human-readable text
            const friendlyMessage = parseContractError(err);
            addLog(`❌ ABORTED: ${friendlyMessage}`);
            toast.error(friendlyMessage, { id: "tx-process" });
            console.error("Audit Trail:", err);
        } finally {
            setLoading(false);
        }
    };

    return {
        walletAddress,
        loading,
        txHash,
        logs,
        setTxHash,
        connectWallet,
        executePayment
    };
};