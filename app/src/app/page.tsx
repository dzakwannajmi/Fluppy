"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useInView, Variants } from "framer-motion";

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
} from "react-icons/fi";
import { BsStars, BsCalculator } from "react-icons/bs";
import { isConnected, requestAccess } from "@stellar/freighter-api";

// Import Komponen Custom
import ColorBends from "../components/ColorBends";
import DotField from "../components/DotField";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LogoLoop from "../components/LogoLoop";

import Link from "next/link";

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
//  ARCHITECTURE SECTION
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
            Four steps <HighlightText>One transaction</HighlightText>
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
//  HERO SECTION
// ═════════════════════════════════════════════════════════════════════════════
function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-28 px-6">
      <div className="max-w-5xl mx-auto text-center">

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }} className="text-5xl sm:text-7xl md:text-[7rem] font-bold tracking-tighter text-white leading-[1.05]">
          Private
          <br />
          <HighlightText>Payments</HighlightText>
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
//  WHAT IS FLUPPY SECTION
// ═════════════════════════════════════════════════════════════════════════════
const FEATURES = [
  { title: "Dynamic Zero-Knowledge", desc: "Prove membership in a whitelist without revealing identity." },
  { title: "On-chain Verification", desc: "BN254 pairing checks executed natively via Stellar Protocol 25 host functions." },
  { title: "Atomic Settlement", desc: "Funds split atomically — 95% to merchant, 5% to treasury — in a single irreversible transaction." },
];

function WhatIsFluppy() {
  return (
    <section id="features" className="relative py-20 px-6 z-10">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SolidCard className="overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-1/3 p-10 flex flex-col justify-between" style={{ background: "#0a080d" }}>
              <div>
                <div className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center" style={{ background: T.primary }}>
                  <BsStars className="text-black text-2xl" />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
                  Built for the<br /><HighlightText>privacy-first</HighlightText><br />economy
                </h2>
              </div>
            </div>

            {/* Kanan: List Fitur */}
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
//  TECH STACK LOOP SECTION
// ═════════════════════════════════════════════════════════════════════════════
const techLogos = [
  {
    node: (
      <div
        className="icon-mask w-[120px] h-[40px]"
        style={{
          maskImage: 'url(/logos/Stellar.svg)',
          WebkitMaskImage: 'url(/logos/Stellar.svg)'
        }}
      />
    ),
    title: "Stellar",
    href: "https://stellar.org"
  },
  {
    node: (
      <div
        className="icon-mask w-[120px] h-[60px]"
        style={{
          maskImage: 'url(/logos/SCF.svg)',
          WebkitMaskImage: 'url(/logos/SCF.svg)'
        }}
      />
    ),
    title: "Stellar Community Fund",
    href: "https://communityfund.stellar.org/"
  },
  {
    node: (
      <div
        className="icon-mask w-[120px] h-[60px]"
        style={{
          maskImage: 'url(/logos/Rise-in.avif)',
          WebkitMaskImage: 'url(/logos/Rise-in.avif)'
        }}
      />
    ),
    title: "Rise in",
    href: "https://www.risein.com/"
  },

];

// ═════════════════════════════════════════════════════════════════════════════
//  DAPP PREVIEW SECTION
// ═════════════════════════════════════════════════════════════════════════════
function DAppPreview() {
  return (
    <section id="payment-preview" className="py-24 relative z-10">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="mb-10 text-center" id="payment">
            <h2 className="text-4xl font-bold text-white mb-4">Experience the Protocol.</h2>
            <p className="text-sm text-foreground/60 max-w-lg mx-auto">Try the Zero-Knowledge payment pipeline directly on testnet.</p>
          </div>

          <Link href="/app" className="block relative group cursor-pointer rounded-[2rem] overflow-hidden">

            <div className="grid lg:grid-cols-2 gap-6 p-6 border rounded-[2rem] opacity-40 blur-[4px] group-hover:blur-md transition-all duration-500" style={{ background: T.card, borderColor: T.border }}>
              {/* Dummy Form */}
              <div className="space-y-6">
                <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10" />
                <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10" />
                <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10" />
                <div className="h-14 w-full rounded-xl mt-10" style={{ background: T.primary }} />
              </div>
              <div className="h-full min-h-[300px] w-full rounded-[2rem] bg-black border border-white/10" />
            </div>

            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-white mb-8">
                #1 privacy payments on
                <div className="icon-mask w40 h-40 md:w-30 md:h-30 bg-white" style={{ maskImage: 'url(/logos/Stellar.svg)', WebkitMaskImage: 'url(/logos/Stellar.svg)' }} />
              </div>
              <button className="px-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center gap-2 hover:scale-105 transition-transform shadow-2xl">
                <BsStars className="text-xl" /> Enter App
              </button>
            </div>

          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  FAQ SECTION (Dengan Dropdown Animasi Halus)
// ═════════════════════════════════════════════════════════════════════════════
const FAQS = [
  { q: "What is Fluppy?", a: "Fluppy is a privacy-first payment gateway built on Stellar Soroban. It allows users to make payments while proving their eligibility (via ZK-SNARKs) without revealing their actual identity to the public ledger." },
  { q: "How does the 95/5 split work?", a: "Unlike traditional gateways that hold funds, Fluppy uses a Soroban Smart Contract to execute an atomic bifurcation. In a single ledger operation, 95% of the USDC goes to the merchant and 5% goes to the protocol treasury." },
  { q: "Do I need a specific wallet?", a: "Yes, currently Fluppy is deeply integrated with the Freighter Wallet extension. You must have Freighter installed and set to the Stellar Testnet." },
  { q: "What is Stellar Protocol 25?", a: "Protocol 25 introduces native BN254 host functions to Soroban. This allows complex Zero-Knowledge Proofs to be verified efficiently directly on-chain." },
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
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
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
          <h2 className="text-4xl font-bold text-white tracking-tight">Questions?<br />Answers</h2>
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

function TechStackLoop() {
  return (
    <section className="relative w-full z-10 pt-16 pb-12" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="max-w-6xl mx-auto px-6 text-center mb-6">
        <span className="text-[17px] font-bold tracking-[0.2em] uppercase" style={{ color: T.fg }}>
          POWERED BY
        </span>
      </div>
      <div style={{ height: '80px', position: 'relative', overflow: 'hidden' }}>
        <LogoLoop
          logos={techLogos}
          speed={120}
          direction="left"
          logoHeight={40}
          gap={80}
          hoverSpeed={30}
          scaleOnHover
          fadeOut
          fadeOutColor={T.bg}
          ariaLabel="Technology Stack"
        />
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

      {/* HERO BACKGROUND LAYER */}
      <div className="absolute top-0 left-0 w-full h-[120vh] pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute inset-0 opacity-40 mix-blend-screen">
          <ColorBends colors={[T.primary]} rotation={90} speed={0.2} scale={1} frequency={1} warpStrength={1} mouseInfluence={1} noise={0.15} parallax={0.5} iterations={1} intensity={1.5} bandWidth={6} transparent autoRotate={0} />
        </div>
        <div className="absolute inset-0 opacity-30"><DotField /></div>
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 0%, transparent 60%, ${T.bg} 100%)` }} />
      </div>

      <div className="relative z-10">
        <Navbar publicKey={publicKey} onConnectWallet={handleConnectWallet} items={navItems} baseColor="rgba(18, 15, 23, 0.4)" />

        {/* ── HERO SECTION ── */}
        <Hero />

        {/* ── FLUPPY SECTION ── */}
        <WhatIsFluppy />

         {/* ── ARCHITECTURE SECTION ── */}
        <Architecture />

         {/* ── PREVIEW SECTION ── */}
        <DAppPreview />

        {/* ── FAQ SECTION ── */}
        <FAQSection />

        {/* ── LOGO LOOP SECTION ── */}
        <TechStackLoop />

        {/* ── FOOTER ── */}
        <Footer />
      </div>
    </div>
  );
}