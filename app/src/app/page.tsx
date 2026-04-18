"use client";

import { useState } from "react";
import { useFluppy } from "../hooks/useFluppy";
import { SuccessReceipt } from "../components/SuccessReceipt";
import ColorBends from "../components/ColorBends";
import DotField from "../components/DotField";

export default function Home() {
  const {
    walletAddress,
    loading,
    txHash,
    connectWallet,
    executePayment,
  } = useFluppy();

  const [hotelWallet, setHotelWallet] = useState("");
  const [amount, setAmount] = useState("10");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };


  if (txHash) return <SuccessReceipt hash={txHash} amount={amount} />;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">

      {/* --- LAYERED BACKGROUND SYSTEM --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 z-0 opacity-30">
          <ColorBends
            colors={["#FF85BB", "#B497CF", "#0F0B0A"]}
            speed={0.15}
            intensity={0.5}
            transparent
          />
        </div>

        <div className="absolute inset-0 z-10 pointer-events-auto">
          <DotField
            intensity={0.5}
            dotRadius={1.5}
            dotSpacing={14}
            bulgeStrength={67}
            glowRadius={160}
            sparkle={false}
            waveAmplitude={0}
            cursorRadius={500}
            cursorForce={0.10}
            bulgeOnly={true}
          />
        </div>
      </div>

      {/* --- CONTENT LAYER --- */}
      <main className="relative z-20 min-h-screen flex flex-col items-center py-16 px-4">
        <h1 className="text-7xl font-black text-primary tracking-[0.1em] uppercase mb-4 drop-shadow-[0_0_15px_rgba(255,133,187,0.3)]">
          Fluppy
        </h1>

        <div className="w-full max-w-lg bg-card/70 backdrop-blur-xl border border-card-border rounded-[2.5rem] p-8 shadow-2xl shadow-primary/10 transition-all border-opacity-50">
          {!walletAddress ? (
            <button
              onClick={connectWallet}
              className="w-full bg-primary text-primary-foreground py-6 rounded-xl font-bold text-sm tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all uppercase"
            >
              Connect Wallet
            </button>
          ) : (
            <div className="space-y-10">
              {/* Wallet Info */}
              <div className="bg-input/40 rounded-xl p-5 border border-card-border relative group">
                <span className="text-[8px] opacity-30 uppercase tracking-[0.2em] mb-2 block">Address</span>
                <div className="flex justify-between items-center gap-4">
                  <p className="text-[10px] break-all leading-relaxed opacity-80 tracking-wide font-mono">
                    {walletAddress}
                  </p>
                  <button onClick={handleCopy} className="text-[10px] text-primary shrink-0 font-bold hover:opacity-50">
                    {copied ? "DONE" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Destination Input */}
              <div className="space-y-4">
                <label className="text-[9px] opacity-30 uppercase tracking-[0.3em] ml-1">Destination_Addr</label>
                <input
                  type="text"
                  className="w-full p-5 bg-input/40 border border-card-border focus:border-primary/50 rounded-xl text-[10px] outline-none tracking-wider placeholder:opacity-10 transition-all"
                  placeholder="G..."
                  onChange={(e) => setHotelWallet(e.target.value)}
                />
              </div>

              {/* Amount Input */}
              <div className="space-y-4">
                <label className="text-[9px] opacity-30 uppercase tracking-[0.3em] ml-1">Transfer_Amount</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-20 text-xl font-black">$</span>
                  <input
                    type="number"
                    className="w-full pl-12 pr-6 py-6 bg-input/40 border border-card-border focus:border-primary/50 rounded-xl text-4xl font-black outline-none tracking-tighter transition-all"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Execute Button */}
              <button
                onClick={() => executePayment(amount, hotelWallet)}
                disabled={loading}
                className="w-full py-7 bg-primary text-primary-foreground rounded-2xl font-black text-xl tracking-[0.2em] shadow-xl shadow-primary/20 uppercase hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {loading ? ">>> PROCESSING_ZKP" : "EXECUTE_PAYMENT"}
              </button>
            </div>
          )}
        </div>

        <footer className="mt-16 opacity-30 text-[8px] tracking-[0.6em] uppercase text-center space-y-3 font-bold">
          <div className="h-[1px] w-12 bg-primary/30 mx-auto" />
          <p>Supported by Stellar</p>
          <p className="opacity-50">© 2026 Fluppy</p>
        </footer>
      </main>
    </div>
  );
}