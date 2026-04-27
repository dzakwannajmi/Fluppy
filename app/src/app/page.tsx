"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// 👇 IMPORT FREIGHTER API 👇
import { isConnected, requestAccess } from "@stellar/freighter-api";

// Import Komponen Custom ReactBits & Milikmu
import ColorBends from "../components/ColorBends";
import DotField from "../components/DotField";
import DecryptedText from "../components/DecryptedText";
import { SuccessReceipt } from "../components/SuccessReceipt"; // Pastikan path ini benar

// ─── Design tokens (DARK THEME) ─────────────────────────────────────────────
const T = {
  bg: "#120F17",
  fg: "#FDFCFD",
  muted: "#94a3b8",
  primary: "var(--primary, #FF85BB)",
  purple: "var(--accent-purple, #B497CF)",
  dark: "#0A080D",
  card: "#1E1B24",
  border: "#2D2A33",
  border2: "#3F3C45",
};

// ─── Shared variants ──────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.11 } } };

type LogKind = "info" | "success" | "error";
type LogEntry = { id: number; icon: string; text: string; kind: LogKind };

// ═════════════════════════════════════════════════════════════════════════════
//  TerminalLog Component
// ═════════════════════════════════════════════════════════════════════════════
function TerminalLog({ logs, running, txHash }: { logs: LogEntry[]; running: boolean; txHash?: string | null }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const hasDone = logs.some((l) => l.kind === "success");
  const hasError = logs.some((l) => l.kind === "error");

  return (
    <div className="w-full rounded-2xl overflow-hidden backdrop-blur-xl relative z-20" style={{ background: `${T.dark}90`, boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 32px 64px -16px rgba(0,0,0,0.65), 0 0 80px -20px ${T.primary}33` }}>
      <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <span className="w-3 h-3 rounded-full bg-green-400/80" />
        <span className="mx-auto text-xs tracking-widest select-none uppercase" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>Soroban Exec Shell</span>
      </div>

      <div className="px-6 py-5 min-h-[240px] max-h-[320px] overflow-y-auto space-y-2.5 text-sm" style={{ fontFamily: "monospace" }}>
        {logs.length === 0 && !running && <p className="text-xs select-none" style={{ color: "rgba(255,255,255,0.3)" }}>Awaiting execution…</p>}
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5 leading-relaxed" style={{ color: log.kind === "success" ? "#4ade80" : log.kind === "error" ? "#f87171" : "rgba(255,255,255,0.8)" }}>
              <span className="flex-shrink-0 text-base leading-none mt-0.5">{log.icon}</span>
              <span>{log.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {running && <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.65 }} className="inline-block w-2 h-[18px] align-middle" style={{ background: T.primary, borderRadius: 1 }} />}
        <div ref={bottomRef} />
      </div>

      <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {running ? (
          <><motion.span animate={{ opacity: [1, 0.25] }} transition={{ repeat: Infinity, duration: 0.9 }} className="w-1.5 h-1.5 rounded-full" style={{ background: T.primary }} /><span className="text-xs" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>executing…</span></>
        ) : hasDone && txHash ? (
          <><span className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="text-xs" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>exit code 0 · proof verified</span><a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs underline underline-offset-2" style={{ fontFamily: "monospace", color: T.primary }}>Explorer →</a></>
        ) : hasError ? (
          <><span className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-xs" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>exit code 1 · check logs</span></>
        ) : (
          <span className="text-xs select-none" style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>ready</span>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Main Page 
// ═════════════════════════════════════════════════════════════════════════════
export default function Page() {
  // UI & Terminal States
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Form & Wallet States
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [secret, setSecret] = useState("2410010454");
  const [destination, setDestination] = useState("GDLST72TGNYOET54VCY7A63FKWHVUWPFAOOKJKCURI3VQXXLWWE7CLSF");
  const [amount, setAmount] = useState("1"); // Default 1 USDC

  const demoRef = useRef<HTMLElement>(null);
  const idRef = useRef(0);

  const addLog = useCallback((icon: string, text: string, kind: LogKind = "info") => {
    setLogs((p) => [...p, { id: ++idRef.current, icon, text, kind }]);
  }, []);

  // ─── CONNECT FREIGHTER WALLET ──────────────────────────────
  // ─── CONNECT FREIGHTER WALLET ──────────────────────────────
  const handleConnectWallet = async () => {
    try {
      const connectedStatus = await isConnected();

      // Freighter API terbaru mengembalikan object { isConnected: boolean }
      if (connectedStatus === true || connectedStatus.isConnected) {

        // Meminta akses ke dompet pengguna (ini akan memunculkan pop-up Freighter)
        const access = await requestAccess();

        if (access.error) {
          throw new Error(access.error);
        }

        const pubKey = access.address; // Freighter menyebutnya 'address', bukan 'publicKey'
        setPublicKey(pubKey);
        addLog("🦊", `Freighter Connected: ${pubKey.slice(0, 6)}...${pubKey.slice(-4)}`, "success");

      } else {
        alert("Please install Freighter extension!");
        window.open("https://freighter.app", "_blank");
      }
    } catch (e: any) {
      console.error(e);
      addLog("❌", `Wallet error: ${e.message}`, "error");
    }
  };

  // ─── EXECUTE PAYMENT ───────────────────────────────────────
  const handleRunPayment = async () => {
    if (!publicKey) {
      alert("Please connect your Freighter wallet first!");
      return;
    }
    if (running) return;

    // Konversi USDC (1 USDC = 10,000,000 stroops)
    const amountStroops = Math.floor(parseFloat(amount) * 10_000_000);

    if (amountStroops <= 0 || isNaN(amountStroops)) {
      alert("Invalid amount!");
      return;
    }

    setRunning(true);
    setDone(false);
    setLogs([]);
    setTxHash(null);

    // Auto-scroll ke terminal
    setTimeout(() => { demoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80);

    try {
      addLog("🛠️", "Generating ZK Proof (Groth16 / BN254)...");

      // 1. Generate Proof API
      const resProof = await fetch('/api/generate-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, destination, amount: amountStroops })
      });
      const dataProof = await resProof.json();
      if (!resProof.ok) throw new Error(dataProof.error);

      addLog("🔐", "Validating Merkle Membership (depth=20)...");
      addLog("🧮", `Computing Hash for Destination: ${destination.slice(0, 5)}...`);
      addLog("📦", "Packaging proof for Soroban (XDR encoding)...");
      addLog("🚀", "Submitting transaction to Stellar Testnet...");

      // 2. Submit Tx API 
      // (Nanti ini akan diubah menggunakan Freighter XDR Signing)
      const resTx = await fetch('/api/submit-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: dataProof.proof, destination, amount: amountStroops })
      });
      const dataTx = await resTx.json();
      if (!resTx.ok) throw new Error(dataTx.error);

      addLog("⛓️", "Executing Smart Contract: execute_payment()...");
      addLog("💸", "Atomic split → 95% merchant · 5% treasury...");
      addLog("🎉", `SUCCESS — Tx: ${dataTx.hash.slice(0, 10)}...`, "success");

      setTxHash(dataTx.hash);
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addLog("❌", `Transaction failed: ${msg}`, "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="relative min-h-screen antialiased overflow-x-hidden" style={{ background: T.bg, color: T.fg, fontFamily: "system-ui, sans-serif" }}>

      {/* 🌟 FIXED BACKGROUND LAYER 🌟 */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0 opacity-40 mix-blend-screen">
          <ColorBends
            colors={["#FF85Bb"]}
            rotation={90} speed={0.2} scale={1} frequency={1} warpStrength={1}
            mouseInfluence={1} noise={0.15} parallax={0.5} iterations={1}
            intensity={1.5} bandWidth={6} transparent autoRotate={0} color="#FF85Bb"
          />
        </div>
        <div className="absolute inset-0 opacity-30">
          <DotField />
        </div>
      </div>

      {/* Layer Content */}
      <div className="relative" style={{ zIndex: 10 }}>

        {/* ── Nav ──────────────────────────────────────────────────── */}
        <nav className="sticky top-0 backdrop-blur-xl border-b" style={{ borderColor: T.border, background: `${T.bg}cc`, zIndex: 50 }}>
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.purple})` }} />
              <span className="font-bold text-lg tracking-tighter">Fluppy</span>
            </div>

            {/* FREIGHTER CONNECT BUTTON */}
            <button
              onClick={handleConnectWallet}
              className="px-5 py-2 rounded-full text-sm font-bold border transition-all hover:scale-105 active:scale-95"
              style={{
                backgroundColor: publicKey ? `${T.purple}10` : "white",
                color: publicKey ? T.primary : "black",
                borderColor: publicKey ? `${T.purple}30` : "transparent",
              }}
            >
              {publicKey ? `🦊 ${publicKey.slice(0, 5)}...${publicKey.slice(-4)}` : "Connect Wallet"}
            </button>
          </div>
        </nav>

        {/* ── Hero & Form Input ───────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-20 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>

            <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 text-xs px-4 py-1.5 rounded-full border backdrop-blur-sm" style={{ fontFamily: "monospace", color: T.purple, borderColor: `${T.purple}40`, background: `${T.purple}10` }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Stellar Testnet · ZK Verified
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl sm:text-7xl font-bold tracking-tighter mb-6 flex flex-col items-center">
              <DecryptedText text="Private Payments" className="text-white" />
              <span style={{ background: `linear-gradient(130deg, ${T.primary} 10%, ${T.purple} 90%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                on Stellar
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg leading-relaxed max-w-xl mx-auto mb-10" style={{ color: T.muted }}>
              Send USDC without exposing amounts or identities. Settled atomically via Soroban Smart Contracts.
            </motion.p>

            {/* 📝 FORM INPUT PEMBAYARAN */}
            <motion.div variants={fadeUp} className="max-w-md mx-auto mb-10 p-6 rounded-2xl border backdrop-blur-xl text-left shadow-2xl" style={{ backgroundColor: `${T.dark}90`, borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold tracking-widest mb-1.5 uppercase" style={{ color: T.purple }}>Identity Secret (NIM)</label>
                  <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold tracking-widest mb-1.5 uppercase" style={{ color: T.purple }}>Destination Address</label>
                  <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold tracking-widest mb-1.5 uppercase" style={{ color: T.purple }}>Amount (USDC)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-white/50">$</span>
                    <input type="number" step="0.1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-black/40 border rounded-xl pl-8 pr-4 py-3 text-sm text-white focus:outline-none transition-colors" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
                  </div>
                </div>
              </div>

              {/* ACTION BUTTON */}
              <button
                onClick={handleRunPayment}
                disabled={running}
                className="w-full mt-6 py-3.5 rounded-xl font-bold text-black transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl"
                style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.purple})`, boxShadow: `0 8px 25px -5px ${T.primary}50` }}
              >
                {running ? (
                  <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Executing Proof...</>
                ) : done ? "▶ Run Another Payment" : "▶ Pay Privately"}
              </button>
            </motion.div>

          </motion.div>
        </section>

        {/* ── Demo / Terminal Section ────────────────────────────────── */}
        <section ref={demoRef as React.RefObject<HTMLElement>} className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Live Proof Execution</h2>
            <p style={{ color: T.muted }}>Watch the ZK pipeline and Smart Contract execution below.</p>
          </div>
          <TerminalLog logs={logs} running={running} txHash={txHash} />

          {/* Munculkan Receipt jika sukses */}
          <AnimatePresence>
            {done && txHash && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-10 flex justify-center relative z-30">
                <SuccessReceipt txHash={txHash} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="mt-20 py-10 px-6 backdrop-blur-md" style={{ borderTop: `1px solid ${T.border}`, background: `${T.dark}50` }}>
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md" style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.purple})` }} />
              <span className="font-semibold text-sm text-white">Fluppy</span>
            </div>
            <p className="text-sm" style={{ color: T.muted }}>
              Built on Stellar + Soroban. ZK privacy for everyone.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}