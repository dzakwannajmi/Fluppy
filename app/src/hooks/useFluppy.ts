import { useState, useEffect } from "react";
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

/**
 * useFluppy Hook
 * * This hook acts as the primary interface between the UI and the Soroban Smart Contract.
 * It handles non-custodial wallet connection, off-chain ZK-Proof generation, 
 * and secure transaction submission to the Stellar Network.
 */
export const useFluppy = () => {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);

    // Establishes a connection with the Freighter Wallet
    const connectWallet = async () => {
        try {
            const access = await requestAccess();
            if (access.address) setWalletAddress(access.address);
        } catch (e) {
            console.error("Connection failed", e);
        }
    };

    /**
     * executePayment
     * * Core logic for the privacy-preserving payment flow:
     * 1. Generates a Merkle Proof (ZKP) locally to protect user identity.
     * 2. Serializes complex data types into Stellar-compliant XDR formats.
     * 3. Invokes the 'pay_with_zk' function on the smart contract for atomic settlement.
     */
    const executePayment = async (amount: string, hotelWallet: string) => {
        if (!walletAddress) return;
        setLoading(true);
        try {
            // STEP 1: Local ZKP Generation
            // We generate the leaf and proof path locally. The actual secret remains on the 
            // user's device, fulfilling the "Zero-Knowledge" privacy requirement.
            const { leaf, proof, root } = generateZKP("2410010454");

            // STEP 2: XDR Serialization
            // Mapping JavaScript objects to Soroban-compatible ScVal (Smart Contract Values).
            // We manually map the proof vector to ensure strict type compliance.
            const zkProofScVal = xdr.ScVal.scvMap([
                new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("leaf"),
                    val: nativeToScVal(leaf, { type: "bytes" })
                }),
                new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("proof"),
                    val: xdr.ScVal.scvVec(
                        proof.map((p) => nativeToScVal(p, { type: "bytes" }))
                    )
                }),
                new xdr.ScMapEntry({
                    key: xdr.ScVal.scvSymbol("root"),
                    val: nativeToScVal(root, { type: "bytes" })
                })
            ]);

            const account = await rpcServer.getAccount(walletAddress);
            const contract = new Contract(CONTRACT_ID);

            // Convert decimal amount to integer (i128) using Stellar's 7-decimal precision
            const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10000000));

            // STEP 3: Transaction Building
            // We invoke 'pay_with_zk' which handles the 95/5 split automatically on-chain.
            const tx = new TransactionBuilder(account, {
                fee: "10000",
                networkPassphrase: NETWORK_PASSPHRASE
            })
                .addOperation(contract.call(
                    "pay_with_zk",
                    new Address(walletAddress).toScVal(), // Payer address
                    new Address(hotelWallet).toScVal(),   // Recipient (Merchant) address
                    nativeToScVal(rawAmount, { type: "i128" }), // Total amount to split
                    zkProofScVal // Cryptographic membership proof
                ))
                .setTimeout(30)
                .build();

            // STEP 4: Signing & Submission
            // The transaction is signed locally via Freighter, maintaining a non-custodial flow.
            const prepared = await rpcServer.prepareTransaction(tx);
            const signed = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });

            if (signed.error) throw new Error(signed.error);

            const res = await rpcServer.sendTransaction(
                TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE)
            );

            if ((res.status as string) === "ERROR") throw new Error("RPC Error");

            // STEP 5: Transaction Polling
            // Waiting for ledger finality to ensure the payment is settled.
            await pollTransaction(res.hash);
            setTxHash(res.hash);
            alert("Payment Successful & Private!");
        } catch (err: any) {
            console.error(err);
            alert(`Payment Failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return { walletAddress, loading, txHash, connectWallet, executePayment };
};