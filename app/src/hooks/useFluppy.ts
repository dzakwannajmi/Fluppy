import { useState, useEffect } from "react";
import { requestAccess, signTransaction } from "@stellar/freighter-api";
import { TransactionBuilder, Contract, nativeToScVal, Address, xdr } from "@stellar/stellar-sdk";
import { generateZKP } from "../lib/zkp";
import { parseContractError } from '../lib/errorMapper';
import { toast } from 'react-hot-toast';
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

    const connectWallet = async () => {
        try {
            const access = await requestAccess();
            if (access.address) setWalletAddress(access.address);
        } catch (e) {
            toast.error("Freighter connection failed.");
        }
    };

    const executePayment = async (amount: string, hotelWallet: string) => {
        if (!walletAddress) return;
        setLoading(true);
        setTxHash(null); // Reset hash sebelumnya

        try {
            // STEP 1: Local ZKP Generation
            const { leaf, proof, root } = generateZKP("2410010454");

            // STEP 2: XDR Serialization
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
            const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10000000));

            // STEP 3: Transaction Building
            const tx = new TransactionBuilder(account, {
                fee: "10000",
                networkPassphrase: NETWORK_PASSPHRASE
            })
                .addOperation(contract.call(
                    "pay_with_zk",
                    new Address(walletAddress).toScVal(),
                    new Address(hotelWallet).toScVal(),
                    nativeToScVal(rawAmount, { type: "i128" }),
                    zkProofScVal
                ))
                .setTimeout(30)
                .build();

            // STEP 4: Signing & Submission
            const prepared = await rpcServer.prepareTransaction(tx);
            const signed = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });

            if (signed.error) throw new Error(signed.error);

            const res = await rpcServer.sendTransaction(
                TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE)
            );

            if ((res.status as string) === "ERROR") throw new Error("RPC Error");

            setTxHash(res.hash);

            // STEP 5: Transaction Polling
            toast.loading("Verifying transaction on-chain...", { id: "tx-poll" });
            const finalResult = await pollTransaction(res.hash);

            if (finalResult?.status === "SUCCESS") {
                toast.success("Payment Successful! 95/5 Split Executed.", { id: "tx-poll" });
            } else {
                throw new Error("Transaction Failed on Chain");
            }

        } catch (err: any) {
            const friendlyMessage = parseContractError(err);
            toast.error(friendlyMessage, {
                id: "tx-poll",
                duration: 6000,
                position: 'top-center',
            });
        } finally {
        
            setLoading(false);
        }
    };

    return { walletAddress, loading, txHash, connectWallet, executePayment };
};