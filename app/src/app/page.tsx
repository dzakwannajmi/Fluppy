"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useInView, Variants } from "framer-motion";

// 👇 IMPORT REACT ICONS 👇
import { 
  FiArrowDown, 
  FiGithub, 
  FiChevronDown, 
  FiSettings, 
  FiLock, 
  FiPackage, 
  FiSend, 
  FiLink, 
  FiDollarSign, 
  FiCheckCircle, 
  FiXCircle, 
  FiKey, 
  FiShield,
  FiRefreshCw
} from "react-icons/fi";
import { BsStars, BsCalculator } from "react-icons/bs";

import { isConnected, requestAccess } from "@stellar/freighter-api";

// Import Komponen Custom
import ColorBends from "../components/ColorBends";
import DotField from "../components/DotField";
import Navbar from "../components/Navbar"; 
import Footer from "../components/Footer";

// ─── Design tokens (SOLID PINK THEME) ─────────────────────────────────────────
const T = {
  bg: "#120F17",
  fg: "#FDFCFD",
  muted: "#94a3b8",
  primary: "#FF85BB", 
  dark: "#0A080D",
  card: "#18151E", 
  border: "rgba(255,255,255,0.08)",
  glass: "rgba(20, 16, 25, 0.6)",
};

// ─── Shared variants ──────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = (delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: delay } },
});

type LogKind = "info" | "success" | "error";
type LogEntry = { id: number; icon: React.ReactNode; text: string; kind: LogKind };

// ═════════════════════════════════════════════════════════════════════════════
//  UI UTILITY COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string; }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger(delay)} className={className}>
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} className="mb-4">
      <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: T.primary }}>
        {children}
      </span>
    </motion.div>
  );
}

// Menggantikan GradientText menjadi Solid Pink Text
function HighlightText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={className} style={{ color: T.primary }}>
      {children}
    </span>
  );
}

function SolidCard({ children, className = "" }: { children: React.ReactNode; className?: string; }) {
  return (
    <div className={`rounded-[2rem] border ${className}`} style={{ background: T.card, borderColor: T.border }}>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  TerminalLog Component
// ═════════════════════════════════════════════════════════════════════════════
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

// ═════════════════════════════════════════════════════════════════════════════
//  ARCHITECTURE
// ═════════════════════════════════════════════════════════════════════════════
const ARCH_NODES = [
  { label: "ZKP Generation", sub: "Client-side Poseidon Merkle proof", glyph: "01" },
  { label: "BN254 Verifier", sub: "Native Soroban host functions", glyph: "02" },
  { label: "Payment Contract", sub: "95/5 atomic split logic", glyph: "03" },
  { label: "Stellar Ledger", sub: "Final settlement + audit event", glyph: "04" },
];

function Architecture() {
  return (
    <section id="architecture" className="relative py-24 px-6 z-10">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionLabel>ARCHITECTURE</SectionLabel>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-12">
            Four steps. <HighlightText>One transaction.</HighlightText>
          </motion.h2>

          <motion.div variants={stagger(0.1)} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {ARCH_NODES.map((n) => (
              <motion.div key={n.label} variants={fadeUp} className="relative">
                <SolidCard className="p-8 h-full flex flex-col hover:border-[#FF85BB]/40 transition-colors">
                  <div className="text-sm font-mono mb-6" style={{ color: T.primary }}>{n.glyph}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{n.label}</h3>
                  <p className="text-sm text-foreground/60 leading-relaxed">{n.sub}</p>
                </SolidCard>
              </motion.div>
            ))}
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  HERO
// ═════════════════════════════════════════════════════════════════════════════
function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-28 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }} className="inline-flex items-center gap-3 px-5 py-2 rounded-full border mb-9" style={{ borderColor: T.border, background: T.glass }}>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-white/80">Live on Stellar Testnet</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }} className="text-5xl sm:text-7xl md:text-[7rem] font-bold tracking-tighter text-white leading-[1.05]">
          Private Payments,
          <br />
          <HighlightText>Finally.</HighlightText>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }} className="mt-9 text-lg md:text-xl text-foreground/60 max-w-2xl mx-auto leading-relaxed">
          ZK-powered payments on Stellar with atomic 95/5 settlement. Prove membership without revealing identity.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#payment" className="flex items-center justify-center gap-2 px-8 py-4 rounded-full text-black font-bold text-sm transition-transform hover:scale-105" style={{ background: T.primary }}>
            Run Live Demo <FiArrowDown className="text-lg" />
          </a>
          <a href="https://github.com/dzakwannajmi/Fluppy" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-8 py-4 rounded-full border font-bold text-sm text-white transition-colors hover:bg-white/5" style={{ borderColor: T.border }}>
            <FiGithub className="text-lg" /> View GitHub
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85, duration: 0.6 }} className="mt-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-xs font-bold uppercase tracking-widest text-white/40">
          <span>BN254 Verified</span>
          <span className="hidden sm:inline">·</span>
          <span>Poseidon Merkle</span>
          <span className="hidden sm:inline">·</span>
          <span>Non-Custodial</span>
        </motion.div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  WHAT IS FLUPPY
// ═════════════════════════════════════════════════════════════════════════════
const FEATURES = [
  { title: "Dynamic Zero-Knowledge", desc: "Prove membership in a whitelist without revealing identity. Poseidon-based Merkle proofs at depth 10." },
  { title: "On-chain Verification", desc: "BN254 pairing checks executed natively via Stellar Soroban Protocol 25 host functions." },
  { title: "Atomic Settlement", desc: "Funds split atomically — 95% to merchant, 5% to treasury — in a single irreversible transaction." },
];

function WhatIsFluppy() {
  return (
    <section id="features" className="relative py-20 px-6 z-10">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SolidCard className="overflow-hidden flex flex-col md:flex-row">
            {/* Kiri: Panel Gelap */}
            <div className="md:w-1/3 p-10 flex flex-col justify-between" style={{ background: "#0a080d" }}>
              <div>
                <div className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center" style={{ background: T.primary }}>
                  <BsStars className="text-black text-2xl" />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
                  Built for the<br /><HighlightText>privacy-first</HighlightText><br />economy.
                </h2>
              </div>
              <p className="mt-10 text-sm text-white/40 font-mono uppercase tracking-widest">
                Stellar Protocol 25
              </p>
            </div>

            <div className="md:w-2/3 p-10 sm:p-14 flex flex-col justify-center gap-8">
              {FEATURES.map((f, i) => (
                <div key={f.title} className={`pb-8 ${i !== FEATURES.length - 1 ? 'border-b' : ''}`} style={{ borderColor: T.border }}>
                  <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide flex items-center gap-2">
                    {f.title}
                  </h3>
                  <p className="text-sm text-foreground/60 leading-relaxed max-w-lg">{f.desc}</p>
                </div>
              ))}
            </div>
          </SolidCard>
        </Reveal>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  FAQ SECTION
// ═════════════════════════════════════════════════════════════════════════════
const FAQS = [
  { q: "What is Fluppy?", a: "Fluppy is a privacy-first payment gateway built on Stellar Soroban. It allows users to make payments while proving their eligibility (via ZK-SNARKs) without revealing their actual identity to the public ledger." },
  { q: "How does the 95/5 split work?", a: "Unlike traditional gateways that hold funds, Fluppy uses a Soroban Smart Contract to execute an atomic bifurcation. In a single ledger operation, 95% of the USDC goes to the merchant and 5% goes to the protocol treasury." },
  { q: "Do I need a specific wallet?", a: "Yes, currently Fluppy is deeply integrated with the Freighter Wallet extension. You must have Freighter installed and set to the Stellar Testnet." },
  { q: "What is Soroban Protocol 25?", a: "Protocol 25 (also known as CAP-0074) introduces native BN254 host functions to Soroban. This allows complex Zero-Knowledge Proofs to be verified efficiently directly on-chain." },
];

function FAQItem({ q, a, isOpen, onClick }: { q: string, a: string, isOpen: boolean, onClick: () => void }) {
  return (
    <div className="border-b transition-colors" style={{ borderColor: isOpen ? T.primary : T.border }}>
      <button onClick={onClick} className="w-full flex justify-between items-center py-6 text-left focus:outline-none group">
        <span className={`text-lg font-bold transition-colors ${isOpen ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>{q}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} className="text-white/50 group-hover:text-white">
          <FiChevronDown size={22} />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
            <div className="pb-6 text-sm text-foreground/60 leading-relaxed pr-8">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); 

  return (
    <section className="relative py-24 px-6 z-10">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
        <div className="md:w-1/3">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="text-4xl font-bold text-white tracking-tight">Questions?<br />Answers.</h2>
        </div>
        <div className="md:w-2/3">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} isOpen={openIndex === i} onClick={() => setOpenIndex(openIndex === i ? null : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Main Page (Stateful)
// ═════════════════════════════════════════════════════════════════════════════
export default function Page() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [secret, setSecret] = useState("2410010454");
  const [destination, setDestination] = useState("GDLST72TGNYOET54VCY7A63FKWHVUWPFAOOKJKCURI3VQXXLWWE7CLSF");
  const [amount, setAmount] = useState("1");

  const demoRef = useRef<HTMLElement>(null);
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
    setTimeout(() => { demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);

    try {
      addLog(<FiSettings className="text-gray-400" />, "Generating ZK Proof (Groth16 / BN254)...");
      const resProof = await fetch('/api/generate-proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, destination, amount: amountStroops })
      });
      const dataProof = await resProof.json();
      if (!resProof.ok) throw new Error(dataProof.error);

      addLog(<FiLock className="text-blue-400" />, "Validating Merkle Membership (depth=20)...");
      addLog(<BsCalculator className="text-yellow-400" />, `Computing Hash for Destination...`);
      addLog(<FiPackage className="text-orange-400" />, "Packaging proof for Soroban (XDR encoding)...");
      addLog(<FiSend className="text-[#FF85BB]" />, "Submitting transaction to Stellar Testnet...");

      const resTx = await fetch('/api/submit-tx', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: dataProof.proof, destination, amount: amountStroops })
      });
      const dataTx = await resTx.json();
      if (!resTx.ok) throw new Error(dataTx.error);

      addLog(<FiLink className="text-indigo-400" />, "Executing Smart Contract: execute_payment()...");
      addLog(<FiDollarSign className="text-emerald-400" />, "Atomic split → 95% merchant · 5% treasury...");
      addLog(<FiCheckCircle className="text-green-500" />, `SUCCESS — Tx: ${dataTx.hash.slice(0, 10)}...`, "success");

      setTxHash(dataTx.hash); setDone(true);
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

  const navItems = [
    { label: "Protocol", bgColor: T.card, textColor: "#fff", links: [{ label: "How it Works", href: "#features", ariaLabel: "How it Works" }] },
    { label: "Ecosystem", bgColor: T.card, textColor: "#fff", links: [{ label: "Stellar Testnet", href: "https://stellar.expert", ariaLabel: "Stellar Network" }] },
    { label: "Developers", bgColor: T.card, textColor: "#fff", links: [{ label: "GitHub Repo", href: "https://github.com/dzakwannajmi/fluppy", ariaLabel: "GitHub Repo" }] }
  ];

  return (
    <div className="relative min-h-screen antialiased overflow-x-hidden" style={{ background: T.bg, color: T.fg }}>
      
      <div className="absolute top-0 left-0 w-full h-[120vh] pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute inset-0 opacity-40 mix-blend-screen">
          <ColorBends colors={[T.primary]} rotation={90} speed={0.2} scale={1} frequency={1} warpStrength={1} mouseInfluence={1} noise={0.15} parallax={0.5} iterations={1} intensity={1.5} bandWidth={6} transparent autoRotate={0} />
        </div>
        <div className="absolute inset-0 opacity-30"><DotField /></div>
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 0%, transparent 60%, ${T.bg} 100%)` }} />
      </div>

      <div className="relative z-10">
        <Navbar publicKey={publicKey} onConnectWallet={handleConnectWallet} items={navItems} baseColor="rgba(18, 15, 23, 0.4)" />

        <Hero />
        <WhatIsFluppy />
        <Architecture />

        {/* ── Payment Section (Minimalist Box) ── */}
        <section id="payment" ref={demoRef as React.RefObject<HTMLElement>} className="py-24 relative z-10">
          <div className="max-w-6xl mx-auto px-6">
            <Reveal>
              <div className="mb-14">
                <SectionLabel>LIVE DEMO</SectionLabel>
                <h2 className="text-4xl font-bold text-white mb-4">Execute Payment.</h2>
                <p className="text-sm text-foreground/60 max-w-lg">Connect Freighter, fund USDC, and try the Zero-Knowledge payment pipeline directly on testnet.</p>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* KIRI: FORM */}
                <SolidCard className="p-8 h-full flex flex-col justify-between">
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest mb-3 block" style={{ color: T.muted }}>Secret Identity (NIM)</label>
                      <div className="relative">
                        <FiLock className="absolute left-5 top-[18px] text-white/30 text-lg" />
                        <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Enter your NIM" style={{...inputStyle, paddingLeft: 46}} onFocus={e => { e.currentTarget.style.borderColor = T.primary; }} onBlur={e => { e.currentTarget.style.borderColor = T.border; }} />
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

                <TerminalLog logs={logs} running={running} txHash={txHash} />
              </div>

            </Reveal>
          </div>
        </section>

        <FAQSection />
        <Footer />
      </div>
    </div>
  );
}