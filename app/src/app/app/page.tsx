"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSettings, FiLock, FiPackage, FiSend, FiLink, FiDollarSign, FiCheckCircle, FiXCircle, FiKey, FiShield, FiRefreshCw } from "react-icons/fi";
import { BsCalculator } from "react-icons/bs";
import { isConnected, requestAccess } from "@stellar/freighter-api";
import Navbar from "../../components/Navbar";

// ─── Design tokens
const T = {
  bg: "#120F17", fg: "#FDFCFD", muted: "#94a3b8", primary: "#FF85BB",
  dark: "#0A080D", card: "#18151E", border: "rgba(255,255,255,0.08)",
};

type LogKind = "info" | "success" | "error";
type LogEntry = { id: number; icon: React.ReactNode; text: string; kind: LogKind };

function SolidCard({ children, className = "" }: { children: React.ReactNode; className?: string; }) {
  return (
    <div className={`rounded-[2rem] border ${className}`} style={{ background: T.card, borderColor: T.border }}>
      {children}
    </div>
  );
}

function TerminalLog({ logs, running, txHash }: { logs: LogEntry[]; running: boolean; txHash?: string | null }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const hasDone = logs.some((l) => l.kind === "success");
  const hasError = logs.some((l) => l.kind === "error");

  return (
    <div className="h-full w-full rounded-[2rem] overflow-hidden flex flex-col relative z-20" style={{ background: `${T.dark}`, border: `1px solid ${T.border}`, boxShadow: `inset 0 0 40px -20px ${T.primary}20`, minHeight: 450 }}>
      <div className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <span className="w-3 h-3 rounded-full bg-green-400/80" />
        <span className="ml-4 text-xs tracking-widest select-none uppercase font-mono flex items-center gap-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          <FiSettings size={12} className="animate-[spin_4s_linear_infinite]" /> Soroban Shell
        </span>
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto space-y-3 text-sm font-mono">
        {logs.length === 0 && !running && <p className="text-xs select-none" style={{ color: "rgba(255,255,255,0.3)" }}>Awaiting execution…</p>}
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 leading-relaxed" style={{ color: log.kind === "success" ? "#4ade80" : log.kind === "error" ? "#f87171" : "rgba(255,255,255,0.8)" }}>
              <span className="flex-shrink-0 text-base leading-none mt-[2px]">{log.icon}</span>
              <span>{log.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {running && <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.65 }} className="inline-block w-2 h-[18px] align-middle" style={{ background: T.primary, borderRadius: 1 }} />}
        <div ref={bottomRef} />
      </div>

      <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: `1px solid ${T.border}` }}>
        {running ? (
          <><motion.span animate={{ opacity: [1, 0.25] }} transition={{ repeat: Infinity, duration: 0.9 }} className="w-2 h-2 rounded-full" style={{ background: T.primary }} /><span className="text-xs" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>executing…</span></>
        ) : hasDone && txHash ? (
          <><span className="w-2 h-2 rounded-full bg-green-400" /><span className="text-xs" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>exit 0 · verified</span><a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs underline underline-offset-2" style={{ fontFamily: "monospace", color: T.primary }}>Explorer →</a></>
        ) : hasError ? (
          <><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-xs" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>exit 1 · check logs</span></>
        ) : (
          <span className="text-xs select-none" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>ready</span>
        )}
      </div>
    </div>
  );
}

export default function AppPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [secret, setSecret] = useState("2410010454");
  const [destination, setDestination] = useState("GDLST72TGNYOET54VCY7A63FKWHVUWPFAOOKJKCURI3VQXXLWWE7CLSF");
  const [amount, setAmount] = useState("1");
  const idRef = useRef(0);

  const addLog = useCallback((icon: React.ReactNode, text: string, kind: LogKind = "info") => {
    setLogs((p) => [...p, { id: ++idRef.current, icon, text, kind }]);
  }, []);

  const handleConnectWallet = async () => {
    try {
      const connectedStatus = await isConnected();
      if (connectedStatus.isConnected) {
        const access = await requestAccess();
        if (access.error) throw new Error(access.error);
        setPublicKey(access.address);
        addLog(<FiKey className="text-[#FF85BB]" />, `Freighter Connected: ${access.address.slice(0, 6)}...${access.address.slice(-4)}`, "success");
      } else {
        alert("Please install Freighter extension!");
        window.open("https://freighter.app", "_blank");
      }
    } catch (e: any) {
      addLog(<FiXCircle className="text-red-400" />, `Wallet error: ${e.message}`, "error");
    }
  };

  const handleRunPayment = async () => {
    if (!publicKey) { alert("Please connect your Freighter wallet first!"); return; }
    if (running) return;

    const amountStroops = Math.floor(parseFloat(amount) * 10_000_000);
    if (amountStroops <= 0 || isNaN(amountStroops)) { alert("Invalid amount!"); return; }

    setRunning(true); setDone(false); setLogs([]); setTxHash(null);

    try {
      addLog(<FiSettings className="text-gray-400" />, "Generating ZK Proof (Groth16 / BN254)...");

      const resProof = await fetch('/api/generate-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, destination, amount: amountStroops })
      });
      const dataProof = await resProof.json();
      if (!resProof.ok) throw new Error(dataProof.error || "Proof generation failed");

      addLog(<FiLock className="text-blue-400" />, "Validating Merkle Membership (depth=20)...");
      addLog(<BsCalculator className="text-yellow-400" />, `Computing Hash for Destination...`);
      addLog(<FiPackage className="text-orange-400" />, "Packaging proof for Soroban (XDR encoding)...");
      addLog(<FiSend className="text-[#FF85BB]" />, "Submitting transaction to Stellar Testnet...");

      const resTx = await fetch('/api/submit-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: dataProof.proof, destination, amount: amountStroops })
      });
      const dataTx = await resTx.json();
      if (!resTx.ok) throw new Error(dataTx.error || "Transaction submission failed");

      addLog(<FiLink className="text-indigo-400" />, "Executing Smart Contract: execute_payment()...");
      addLog(<FiDollarSign className="text-emerald-400" />, "Atomic split → 95% merchant · 5% treasury...");

      addLog(<FiCheckCircle className="text-green-500" />, `SUCCESS — Tx: ${dataTx.hash.slice(0, 10)}...`, "success");

      setTxHash(dataTx.hash);
      setDone(true);
    } catch (err: any) {
      addLog(<FiXCircle className="text-red-400" />, `Transaction failed: ${err.message}`, "error");
    } finally {
      setRunning(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "transparent", border: `1px solid ${T.border}`, borderRadius: 16,
    color: "white", fontSize: 14, outline: "none", padding: "16px", width: "100%",
    transition: "border-color 0.2s",
  };

  const navItems = [{ label: "Return to Home", bgColor: T.card, textColor: "#fff", links: [{ label: "Back", href: "/", ariaLabel: "Home" }] }];

  return (
    <div className="relative min-h-screen antialiased overflow-x-hidden" style={{ background: T.bg, color: T.fg }}>
      <div className="relative z-10 pt-4">
        <Navbar publicKey={publicKey} onConnectWallet={handleConnectWallet} items={navItems} baseColor="rgba(18, 15, 23, 0.4)" />

        <div className="max-w-6xl mx-auto px-6 pt-24 pb-12">
          <div className="mb-10">
            <h1 className="text-xs font-bold uppercase tracking-widest" style={{ color: T.primary }}>Live DApp</h1>
            <h2 className="text-3xl font-bold text-white mt-2">Execute Payment.</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* KIRI: FORM */}
            <SolidCard className="p-8 h-full flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: T.muted }}>Secret Identity (NIM)</label>
                  <div className="relative">
                    <FiLock className="absolute left-5 top-[18px] text-white/30 text-lg" />
                    <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Enter your NIM" style={{ ...inputStyle, paddingLeft: 46 }} onFocus={e => { e.currentTarget.style.borderColor = T.primary; }} onBlur={e => { e.currentTarget.style.borderColor = T.border; }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: T.muted }}>Destination Address</label>
                  <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="G... Stellar address" style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }} onFocus={e => { e.currentTarget.style.borderColor = T.primary; }} onBlur={e => { e.currentTarget.style.borderColor = T.border; }} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: T.muted }}>Amount (USDC)</label>
                  <div className="relative">
                    <FiDollarSign className="absolute left-5 top-[18px] text-white/50 text-lg" />
                    <input type="number" step="0.1" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, paddingLeft: 42 }} onFocus={e => { e.currentTarget.style.borderColor = T.primary; }} onBlur={e => { e.currentTarget.style.borderColor = T.border; }} />
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <button onClick={handleRunPayment} disabled={running || !secret || !destination || !amount} className="w-full py-4 rounded-xl font-bold text-black transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl flex justify-center items-center gap-2" style={{ background: T.primary }}>
                  {running ? <><FiSettings className="animate-spin text-lg" /> Executing...</> : done ? <><FiRefreshCw className="text-lg" /> Pay Again</> : <><FiShield className="text-lg" /> Pay with ZK</>}
                </button>
              </div>
            </SolidCard>

            {/* KANAN: TERMINAL */}
            <TerminalLog logs={logs} running={running} txHash={txHash} />
          </div>
        </div>
      </div>
    </div>
  );
}