// src/app/page.tsx
// SCF AUDIT: FULLY INTEGRATED UI FOR ZK-PAYMENT
// CHANGES:
// 1. Added nimSecret state + input field (required for ZKP)
// 2. Updated executePayment call to pass 3 parameters (matches useFluppy.ts)
// 3. Button disabled when nimSecret empty or loading
// 4. UI improved with clean NIM input (privacy-focused design)

"use client";

import { useState, useRef } from "react";
import { useFluppy } from "../hooks/useFluppy";
import { SuccessReceipt } from "../components/SuccessReceipt";

// --- MOTION & REACT BITS ---
import { motion, AnimatePresence } from "motion/react";
import ColorBends from "../components/ColorBends";
import DotField from "../components/DotField";
import DecryptedText from "../components/DecryptedText";
import VariableProximity from "../components/VariableProximity";

export default function Home() {
  const {
    walletAddress,
    loading,
    txHash,
    setTxHash,
    logs,
    connectWallet,
    executePayment,
  } = useFluppy();

  const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
  const [hotelWallet, setHotelWallet] = useState("");
  const [amount, setAmount] = useState("1.0");
  const [nimSecret, setNimSecret] = useState("");   // ← NEW: NIM/Secret ID
  const [copied, setCopied] = useState(false);

  const containerRef = useRef(null);

  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // SCF AUDIT: Prevent calling with empty NIM
  const isFormValid = !!walletAddress && !!hotelWallet && !!nimSecret.trim();

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden font-mono bg-background transition-colors duration-500">

      {/* --- SUCCESS RECEIPT MODAL --- */}
      <AnimatePresence>
        {txHash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative max-w-2xl w-full"
            >
              <button
                onClick={() => setTxHash(null)}
                className="absolute -top-12 right-0 text-primary font-pixel-square text-[10px] hover:scale-105 transition-all cursor-pointer bg-primary/10 px-4 py-2 border border-primary/20 rounded-lg"
              >
                [ RETURN_TO_DASHBOARD ]
              </button>
              <SuccessReceipt hash={txHash} amount={amount} onDone={() => setTxHash(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- BACKGROUND --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 opacity-20">
          <ColorBends colors={["#FF85BB", "#B497CF", "#0F0B0A"]} speed={0.1} />
        </div>
        <DotField intensity={0.3} dotRadius={1.2} dotSpacing={18} />
      </div>

      <main className="relative z-20 container mx-auto py-10 px-6 max-w-7xl">

        {/* HEADER & NETWORK SWITCHER */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6 border-b border-card-border pb-8">
          <div ref={containerRef} style={{ position: 'relative' }}>
            <VariableProximity
              label="FLUPPY"
              className="text-6xl font-pixel-square text-primary tracking-tighter"
              fromFontVariationSettings="'wght' 400"
              toFontVariationSettings="'wght' 900"
              containerRef={containerRef}
              radius={100}
              falloff="linear"
            />
          </div>

          {/* BASH STYLE NETWORK TOGGLE */}
          <div className="flex bg-card/30 border border-card-border p-1.5 rounded-2xl backdrop-blur-md">
            <button
              onClick={() => setNetwork("testnet")}
              className={`px-6 py-2 rounded-xl text-[10px] font-bold transition-all ${network === "testnet" ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(255,133,187,0.3)]" : "opacity-30 hover:opacity-50"}`}
            >
              TESTNET_V1
            </button>
            <button
              disabled
              className="px-6 py-2 rounded-xl text-[10px] font-bold opacity-10 cursor-not-allowed italic"
            >
              MAINNET (PHASE_5)
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* PANEL KIRI: TRANSACTION & WALLET */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-card/40 backdrop-blur-3xl border border-card-border rounded-[2.5rem] p-8 shadow-2xl">
              {!walletAddress ? (
                <button
                  onClick={connectWallet}
                  className="w-full py-8 bg-primary text-primary-foreground rounded-2xl font-black tracking-widest uppercase text-xs hover:brightness-110 hover:shadow-[0_0_20px_rgba(255,133,187,0.4)] transition-all active:scale-95 cursor-pointer"
                >
                  Authorize_Freighter
                </button>
              ) : (
                <div className="space-y-8">
                  {/* Active Wallet */}
                  <div className="flex justify-between items-end bg-glow/40 p-5 rounded-2xl border border-card-border/50">
                    <div className="overflow-hidden">
                      <label className="text-[7px] opacity-40 uppercase tracking-[0.3em] mb-2 block">Active_Identity</label>
                      <p className="text-[10px] text-primary font-bold truncate pr-4">{walletAddress}</p>
                    </div>
                    <button
                      onClick={connectWallet}
                      className="shrink-0 text-[8px] border border-primary/30 text-primary px-3 py-2 rounded-lg hover:bg-primary/10 transition-all font-bold"
                    >
                      SWITCH
                    </button>
                  </div>

                  {/* INPUTS */}
                  <div className="space-y-6">
                    {/* Destination Merchant */}
                    <div>
                      <label className="text-[8px] opacity-40 uppercase tracking-widest mb-3 block">Destination_Merchant</label>
                      <input
                        type="text"
                        className="w-full p-4 bg-input/20 border border-card-border focus:border-primary rounded-xl text-[10px] outline-none transition-all"
                        placeholder="G... Address"
                        value={hotelWallet}
                        onChange={(e) => setHotelWallet(e.target.value)}
                      />
                    </div>

                    {/* Amount USDC */}
                    <div>
                      <label className="text-[8px] opacity-40 uppercase tracking-widest mb-3 block">Amount_USDC</label>
                      <input
                        type="number"
                        className="w-full p-5 bg-input/20 border border-card-border focus:border-primary rounded-xl text-4xl font-black outline-none transition-all"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    {/* NEW: NIM / Secret ID Input (Privacy Field) */}
                    <div>
                      <label className="text-[8px] opacity-40 uppercase tracking-widest mb-3 block">
                        NIM_Secret_ID <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full p-4 bg-input/20 border border-card-border focus:border-primary rounded-xl text-[10px] outline-none transition-all font-mono"
                        placeholder="2410010454"
                        value={nimSecret}
                        onChange={(e) => setNimSecret(e.target.value)}
                      />
                      <p className="text-[8px] text-primary/50 mt-1">Private identifier • never leaves your device</p>
                    </div>
                  </div>

                  {/* EXECUTE BUTTON - Now with 3 parameters */}
                  <button
                    onClick={() => executePayment(amount, hotelWallet, nimSecret)}
                    disabled={!isFormValid || loading}
                    className="w-full py-6 bg-primary text-primary-foreground rounded-2xl font-black text-sm tracking-[0.3em] uppercase shadow-lg shadow-primary/20 hover:brightness-110 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-wait cursor-pointer"
                  >
                    {loading ? ">>> RUNNING ZKP..." : "EXECUTE_ZK_PAYMENT"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* PANEL KANAN: TRANSPARENCY BASH TERMINAL */}
          <div className="lg:col-span-7">
            <div className="bg-[#050505] border border-card-border rounded-[2.5rem] p-8 h-[600px] flex flex-col shadow-inner">
              <div className="flex justify-between items-center mb-8 border-b border-card-border/50 pb-5">
                <div className="flex items-center gap-3 font-pixel-square text-[9px] text-primary tracking-[0.4em]">
                  <span className={`w-2 h-2 rounded-full ${network === 'testnet' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  LIVE_SOROBAN_AUDIT
                </div>
                <span className="text-[8px] opacity-20 font-bold uppercase">v1.0.4-stable</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 space-y-4">
                    <p className="text-[9px] uppercase tracking-[0.8em]">System Idle</p>
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-primary/40 text-[9px] font-bold mt-1">[{i + 1}]</span>
                      <div className="text-[11px] leading-relaxed text-foreground/80">
                        <DecryptedText
                          text={log}
                          speed={50}
                          className={log.includes("✓") ? "text-green-400 font-bold" : ""}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

        <footer className="mt-20 text-center opacity-20 text-[8px] tracking-[0.5em] font-bold uppercase">
          Prototyping Privacy on Stellar Soroban 2026
        </footer>

      </main>
    </div>
  );
}