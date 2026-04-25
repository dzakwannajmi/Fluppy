// src/hooks/useFluppy.ts
// SCF AUDIT: FULLY INTEGRATED WITH ZKP.TS (Soroban Protocol 25)
// CHANGES MADE:
// 1. Added 'use client' → ensures hook never runs on server
// 2. Confirmed correct call to generateZkProof(secretId, WHITELIST)
// 3. Added extra safety validation for nimSecret (double protection)
// 4. Improved logging & error handling for better audit trail
// 5. Kept your original WHITELIST + Freighter + payWithZk flow

'use client';

import { useState, useCallback } from "react";
import { requestAccess } from "@stellar/freighter-api";
import { generateZkProof } from "../lib/zkp";
import { parseContractError } from '../lib/errorMapper';
import { toast } from 'react-hot-toast';
import {
    payWithZk
} from "../lib/stellar";

/**
 * AUTHORIZED WHITELIST (NIM List)
 * In production, fetch this from your backend/database.
 * Order MUST be consistent for the Merkle Tree to be valid.
 */
const WHITELIST = [
    "2410010454",
    "2410010001",
    "2410010002",
    "2410010003",
    // ... add more as needed
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
        } catch {
            addLog("ERR: Connection failed.");
            toast.error("Connection failed.");
        }
    };

    /**
     * executePayment
     * Fully integrated with updated generateZkProof(secretId, whitelist)
     */
    const executePayment = async (amount: string, hotelWallet: string, nimSecret: string) => {
        if (!walletAddress) {
            toast.error("Please connect wallet first");
            return;
        }

        // SCF AUDIT: Extra safety check (double protection)
        if (!nimSecret || typeof nimSecret !== 'string' || nimSecret.trim() === '') {
            toast.error("NIM/Secret ID is required");
            addLog("❌ ERROR: nimSecret is empty or undefined");
            return;
        }

        setLoading(true);
        setTxHash(null);
        setLogs([]);

        try {
            addLog("System: Starting ZK-Privacy Settlement...");

            /**
             * STEP 1: ZK Proof Generation
             * Now correctly passes BOTH parameters to match zkp.ts signature
             */
            addLog("ZKP: Computing Poseidon-based Merkle Path (Depth 10)...");

            // ✅ INTEGRATED CALL - matches new zkp.ts exactly
            const zkProof = await generateZkProof(nimSecret, WHITELIST);

            addLog("ZKP: Verifier payload prepared successfully (Merkle root + BN254 points).");

            const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10_000_000));
            addLog(`Finance: Scaling amount to ${rawAmount} stroops...`);

            /**
             * STEP 2: Submit to Stellar Soroban Contract
             */
            addLog("Stellar: Requesting signature via Freighter...");
            toast.loading("Awaiting Signature...", { id: "tx-process" });

            const finalResult = await payWithZk(hotelWallet, rawAmount, zkProof) as any;

            if (finalResult && finalResult.status === "SUCCESS") {
                // Gunakan .txHash atau .hash (tergantung versi SDK, biasanya txHash)
                const hashToDisplay = finalResult.txHash || finalResult.hash;

                setTxHash(hashToDisplay);
                addLog(`✓ SUCCESS: Tx Hash [${hashToDisplay.slice(0, 10)}]...`);
                toast.success("ZK Payment Successful!", { id: "tx-process" });
            }

        } catch (err: unknown) {
            const friendlyMessage = parseContractError(err);
            addLog(`❌ ABORTED: ${friendlyMessage}`);
            toast.error(friendlyMessage, { id: "tx-process" });
            console.error("Full error for audit:", err);
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
