"use client";

import { useState } from "react";
import { MerkleTree } from 'merkletreejs';
import CryptoJS from 'crypto-js';
import { Buffer } from "buffer";
import { requestAccess, signTransaction } from "@stellar/freighter-api";
import {
  rpc,
  Horizon,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  Address,
  xdr
} from "@stellar/stellar-sdk";

// --- 1. ZKP LOGIC (SHA256 SYNC WITH SOROBAN) ---

// Helper agar SHA256 browser cocok dengan SHA256 Rust
const sha256 = (data: Buffer | string): Buffer => {
  const content = Buffer.isBuffer(data) ? data.toString('hex') : Buffer.from(data).toString('hex');
  const hash = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(content));
  return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
};

const WHITELIST = ["2410010454", "2410010001", "2410010002"];
// Gunakan SHA256 untuk leaves
const leaves = WHITELIST.map(id => sha256(Buffer.from(id)));
const tree = new MerkleTree(leaves, sha256, { sortPairs: true });
const MERKLE_ROOT = tree.getHexRoot();

export default function Home() {
  // --- STATE ---
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [ownerAddressInput, setOwnerAddressInput] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("10");
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  // --- CONFIG FROM ENV ---
  const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID!;
  const DEV_OPS_WALLET = process.env.NEXT_PUBLIC_DEV_OPS_WALLET!;
  const USDC_ID = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID!;

  const rpcServer = new rpc.Server(process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org:443");
  const horizonServer = new Horizon.Server(process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org");

  // --- HELPERS ---
  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const connectWallet = async () => {
    try {
      const access = await requestAccess();
      if (access.address) setWalletAddress(access.address);
    } catch (e) {
      alert("Gagal terhubung. Pastikan Freighter aktif.");
    }
  };

  // --- CORE EXECUTION ---
  const executePayment = async () => {
    if (!walletAddress || !ownerAddressInput) return;
    setLoading(true);

    try {
      // 1. Generate Proof (James NIM: 2410010454)
      const userNIM = "2410010454";
      const myLeaf = sha256(Buffer.from(userNIM));
      const myProof = tree.getProof(myLeaf);
      const cleanRootStr = MERKLE_ROOT.replace('0x', '');

      // 2. Explicit Mapping (Urutan Alfabet + Explicit Type)
      const configScVal = xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("dev_ops"),
          val: new Address(DEV_OPS_WALLET).toScVal()
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("fee_percentage"),
          val: nativeToScVal(BigInt(500), { type: "i128" })
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("usdc_token"),
          val: new Address(USDC_ID).toScVal()
        })
      ]);

      const zkProofScVal = xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("leaf"),
          val: nativeToScVal(myLeaf, { type: "bytes" })
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("proof"),
          val: nativeToScVal(myProof.map(p => p.data), { type: "bytes" })
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("root"),
          val: nativeToScVal(Buffer.from(cleanRootStr, 'hex'), { type: "bytes" })
        })
      ]);

      const rawAmount = BigInt(Math.floor(parseFloat(amountInput) * 10000000));
      const amountScVal = nativeToScVal(rawAmount, { type: "i128" });

      const account = await horizonServer.loadAccount(walletAddress);
      const contract = new Contract(CONTRACT_ID);

      const tx = new TransactionBuilder(account, {
        fee: "1000",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "pay_with_zk",
            configScVal,
            new Address(walletAddress).toScVal(),
            new Address(ownerAddressInput.trim()).toScVal(),
            amountScVal,
            zkProofScVal
          )
        )
        .setTimeout(30)
        .build();

      const preparedTransaction = await rpcServer.prepareTransaction(tx);
      const freighterResult = await signTransaction(preparedTransaction.toXDR(), {
        networkPassphrase: Networks.TESTNET,
      });

      if (freighterResult.error) throw new Error(freighterResult.error);

      const response = await rpcServer.sendTransaction(
        TransactionBuilder.fromXDR(freighterResult.signedTxXdr, Networks.TESTNET)
      );

      // Polling Logic
      if ((response.status as string) === "SUCCESS") {
        setTxHash(response.hash);
        setIsSuccess(true);
      } else {
        let status: string = response.status;
        while (status !== "SUCCESS") {
          const txStatus = await rpcServer.getTransaction(response.hash);
          status = txStatus.status;
          if (status === "SUCCESS") {
            setTxHash(response.hash);
            setIsSuccess(true);
            break;
          } else if (status === "FAILED") throw new Error("Blockchain merejek transaksi.");
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } catch (error: any) {
      console.error("DEBUG ERROR:", error);
      alert(`Gagal: ${error.message || "Pastikan NIM terdaftar di whitelist!"}`);
    } finally {
      setLoading(false);
    }
  };

  // --- VIEW: SUCCESS RECEIPT ---
  if (isSuccess) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="w-full max-w-md bg-card border-2 border-primary rounded-[2.5rem] p-8 text-center shadow-2xl shadow-primary/10">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter">Success!</h2>
          <div className="bg-input rounded-2xl p-6 mb-8 text-left space-y-4 border border-card-border">
            <div className="flex justify-between items-center text-xs">
              <span className="opacity-40 font-bold uppercase">Amount</span>
              <span className="font-bold text-primary">{amountInput} USDC</span>
            </div>
            <div className="h-[1px] bg-card-border" />
            <div className="text-center">
              <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">
                Verify on Explorer ↗
              </a>
            </div>
          </div>
          <button onClick={() => { setIsSuccess(false); setAmountInput(""); setOwnerAddressInput(""); }} className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black">
            Done
          </button>
        </div>
      </main>
    );
  }

  // --- VIEW: CHECKOUT FORM ---
  return (
    <main className="min-h-screen flex flex-col items-center py-16 px-4 bg-background text-foreground">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-black tracking-tighter mb-2 text-primary uppercase">Fluppy</h1>
        <p className="opacity-40 text-xs font-bold tracking-[0.3em] uppercase">Trustless Split-Payment</p>
      </header>

      <div className="w-full max-w-lg bg-card rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-card-border p-8 transition-all">
        {!walletAddress ? (
          <button onClick={connectWallet} className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all">
            Connect Wallet
          </button>
        ) : (
          <div className="space-y-8">
            <div className="bg-input rounded-2xl p-4 border border-card-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">Connected Wallet</span>
                <button onClick={handleCopy} className="text-[10px] font-bold text-primary uppercase hover:opacity-70 transition-all">
                  {copied ? "✓ Copied" : "Copy Address"}
                </button>
              </div>
              <p className="font-mono text-[11px] break-all font-bold text-foreground/80 leading-relaxed">{walletAddress}</p>
            </div>

            <div>
              <label className="block text-[10px] font-black opacity-30 mb-3 uppercase tracking-widest ml-1">Recipient (Hotel Wallet)</label>
              <input
                type="text"
                value={ownerAddressInput}
                onChange={(e) => setOwnerAddressInput(e.target.value)}
                className="w-full p-5 bg-input border-2 border-transparent focus:border-primary rounded-2xl text-[11px] font-mono font-bold outline-none transition-all"
                placeholder="G..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-black opacity-30 mb-3 uppercase tracking-widest ml-1">Amount (USDC)</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black opacity-20">$</span>
                <input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full pl-12 pr-6 py-6 bg-input border-2 border-transparent focus:border-primary rounded-2xl text-4xl font-black outline-none transition-all"
                />
              </div>
            </div>

            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 flex justify-between items-center">
              <span className="text-[10px] font-black opacity-40 uppercase">Network Fee</span>
              <span className="text-xs font-bold text-primary">{estimatedFee ? `${estimatedFee} XLM` : "--"}</span>
            </div>

            <button
              onClick={executePayment}
              disabled={loading || !ownerAddressInput}
              className={`w-full py-6 rounded-[1.5rem] font-black text-xl transition-all shadow-xl shadow-primary/20
                ${loading || !ownerAddressInput ? "bg-slate-100 text-slate-300" : "bg-primary text-primary-foreground hover:scale-[1.01]"}
              `}
            >
              {loading ? "Verifying ZKP..." : `Confirm Payment`}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}