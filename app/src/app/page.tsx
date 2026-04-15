"use client";

import { useState } from "react";
import { useFluppy } from "../hooks/useFluppy";
import { SuccessReceipt } from "../components/SuccessReceipt";

export default function Home() {
  const {
    walletAddress,
    loading,
    txHash,
    connectWallet,
    executePayment
  } = useFluppy();

  const [hotelWallet, setHotelWallet] = useState("");
  const [amount, setAmount] = useState("10");
  const [copied, setCopied] = useState(false);

  // Helper untuk menyalin alamat wallet ke clipboard
  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Tampilkan layar sukses jika transaksi berhasil
  if (txHash) return <SuccessReceipt hash={txHash} amount={amount} />;

  return (
    <main className="min-h-screen bg-background font-roboto flex flex-col items-center py-16 px-4 transition-colors duration-300">

      {/* Header Section */}
      <header className="text-center mb-12">
        <h1 className="text-6xl font-black text-primary tracking-tighter uppercase mb-2">
          Fluppy
        </h1>
        <p className="opacity-40 text-[10px] font-bold tracking-[0.4em] uppercase">
          Trustless Split-Payment
        </p>
      </header>

      {/* Main Card Container */}
      <div className="w-full max-w-lg bg-card border border-card-border rounded-[2.5rem] p-8 shadow-2xl shadow-primary/5 transition-all">

        {!walletAddress ? (
          /* View: Belum Terhubung ke Wallet */
          <div className="py-4 space-y-6 text-center">
            <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
              <p className="text-xs font-bold opacity-60 leading-relaxed">
                Connect your Freighter wallet to start making verified ZK payments.
              </p>
            </div>
            <button
              onClick={connectWallet}
              className="w-full bg-primary text-primary-foreground font-black py-5 rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          /* View: Form Pembayaran (Sudah Terhubung) */
          <div className="space-y-8">

            {/* Wallet Status Card */}
            <div className="bg-input rounded-2xl p-4 border border-card-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">
                  Connected Wallet
                </span>
                <button
                  onClick={handleCopy}
                  className="text-[10px] font-bold text-primary uppercase hover:opacity-70 transition-all"
                >
                  {copied ? "✓ Copied" : "Copy Address"}
                </button>
              </div>
              <p className="font-mono text-[11px] break-all font-bold text-foreground/80 leading-relaxed">
                {walletAddress}
              </p>
            </div>

            {/* Input: Hotel Wallet Address */}
            <div>
              <label className="block text-[10px] font-black opacity-30 mb-3 uppercase tracking-widest ml-1">
                Recipient (Hotel Wallet)
              </label>
              <input
                type="text"
                value={hotelWallet}
                onChange={(e) => setHotelWallet(e.target.value)}
                className="w-full p-5 bg-input border-2 border-transparent focus:border-primary rounded-2xl text-[11px] font-mono font-bold outline-none transition-all placeholder:opacity-20"
                placeholder="G..."
              />
            </div>

            {/* Input: Amount with Visual Indicator */}
            <div>
              <label className="block text-[10px] font-black opacity-30 mb-3 uppercase tracking-widest ml-1">
                Amount (USDC)
              </label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black opacity-20">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-12 pr-6 py-6 bg-input border-2 border-transparent focus:border-primary rounded-2xl text-4xl font-black outline-none transition-all"
                />
              </div>
            </div>

            {/* Platform Fee Information */}
            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-black opacity-40 uppercase">Platform Fee</span>
                <span className="text-[9px] font-bold opacity-30 italic">Sent to DevOps Wallet</span>
              </div>
              <span className="text-xs font-bold text-primary">5.0%</span>
            </div>

            {/* Execution Button */}
            <button
              onClick={() => executePayment(amount, hotelWallet)}
              disabled={loading || !hotelWallet}
              className={`w-full py-6 rounded-[1.5rem] font-black text-xl transition-all shadow-xl shadow-primary/20
                ${loading || !hotelWallet
                  ? "bg-input text-foreground/20 cursor-not-allowed border border-card-border"
                  : "bg-primary text-primary-foreground hover:scale-[1.01] active:scale-[0.98]"
                }
              `}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying ZKP...
                </span>
              ) : (
                "Confirm Payment"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="mt-12 text-[10px] font-bold opacity-20 uppercase tracking-[0.3em] flex flex-col items-center gap-2">
        <span>Powered by Soroban & Internet Computer</span>
        <div className="h-[1px] w-8 bg-foreground opacity-20" />
      </footer>
    </main>
  );
}