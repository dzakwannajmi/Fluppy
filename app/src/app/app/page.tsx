"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSettings, FiLock, FiPackage, FiSend, FiLink,
  FiDollarSign, FiCheckCircle, FiXCircle, FiKey,
  FiShield, FiRefreshCw, FiEye, FiEyeOff, FiUserPlus,
} from "react-icons/fi";
import { BsCalculator } from "react-icons/bs";
import { isConnected } from "@stellar/freighter-api";
import Navbar from "../../components/Navbar";
import { useFluppy } from "../../hooks/useFluppy";
import { ProofProgressBar } from '../../components/ProofProgressBar';
import { TxHistoryPanel } from '../../components/TxHistoryPanel';
import { buildExplorerUrl } from "../../lib/history";

// ─── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg: "#120F17",
  fg: "#FDFCFD",
  muted: "#94a3b8",
  primary: "#FF85BB",
  dark: "#0A080D",
  card: "#18151E",
  border: "rgba(255,255,255,0.08)",
};

// ─── Tipe ────────────────────────────────────────────────────────────────────
type LogKind = "info" | "success" | "error";
type LogEntry = { id: number; icon: React.ReactNode; text: string; kind: LogKind };

// ─── SolidCard ───────────────────────────────────────────────────────────────
function SolidCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[2rem] border ${className}`}
      style={{ background: T.card, borderColor: T.border }}
    >
      {children}
    </div>
  );
}

// ─── TerminalLog ─────────────────────────────────────────────────────────────
function TerminalLog({
  logs,
  running,
  txHash,
}: {
  logs: LogEntry[];
  running: boolean;
  txHash?: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const hasDone = logs.some(l => l.kind === "success");
  const hasError = logs.some(l => l.kind === "error");

  // Helper footer — hindari ternary Fragment bersarang
  function renderFooter(): React.ReactNode {
    if (running) {
      return (
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ opacity: [1, 0.25] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
            className="w-2 h-2 rounded-full"
            style={{ background: T.primary }}
          />
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
            executing…
          </span>
        </div>
      );
    }

    if (hasDone && txHash) {
      return (
        <div className="flex items-center gap-3 w-full">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
            exit 0 · verified
          </span>

          <a
            href={buildExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs underline underline-offset-2 font-mono"
            style={{ color: T.primary } as React.CSSProperties}
          >
            Explorer →
          </a>
        </div >
      );
    }

    if (hasError) {
      return (
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
            exit 1 · check logs
          </span>
        </div>
      );
    }

    return (
      <span className="text-xs select-none font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
        ready
      </span>
    );
  }

  return (
    <div
      className="h-full w-full rounded-[2rem] overflow-hidden flex flex-col relative z-20"
      style={{
        background: T.dark,
        border: `1px solid ${T.border}`,
        boxShadow: `inset 0 0 40px -20px ${T.primary}20`,
        minHeight: 450,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-6 py-4"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <span className="w-3 h-3 rounded-full bg-green-400/80" />
        <span
          className="ml-4 text-xs tracking-widest uppercase font-mono flex items-center gap-2 select-none"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          <FiSettings size={12} className="animate-[spin_4s_linear_infinite]" />
          Soroban Shell
        </span>
      </div>

      {/* Log area */}
      <div className="flex-1 px-6 py-6 overflow-y-auto space-y-3 text-sm font-mono">
        {logs.length === 0 && !running && (
          <p className="text-xs select-none" style={{ color: "rgba(255,255,255,0.3)" }}>
            Awaiting execution…
          </p>
        )}
        <AnimatePresence>
          {logs.map(log => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 leading-relaxed"
              style={{
                color:
                  log.kind === "success"
                    ? "#4ade80"
                    : log.kind === "error"
                      ? "#f87171"
                      : "rgba(255,255,255,0.8)",
              }}
            >
              <span className="flex-shrink-0 text-base leading-none mt-[2px]">
                {log.icon}
              </span>
              <span>{log.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {running && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.65 }}
            className="inline-block w-2 h-[18px] align-middle"
            style={{ background: T.primary, borderRadius: 1 }}
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div
        className="px-6 py-4"
        style={{ borderTop: `1px solid ${T.border}` }}
      >
        {renderFooter()}
      </div>
    </div>
  );
}

// ─── Input style ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  color: "white",
  fontSize: 14,
  outline: "none",
  padding: "16px",
  width: "100%",
  transition: "border-color 0.2s",
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AppPage() {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("1");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [localLogs, setLocalLogs] = useState<LogEntry[]>([]);

  const idRef = useRef(0);

  // ── Fluppy Hook ────────────────────────────────────────────────────────────
  const {
    walletAddress,
    connectWallet,
    credentialStatus,
    checkCredentialStatus,
    setupCredential,
    loading,
    txHash,
    logs: hookLogs,
    proofProgress,
    setTxHash,
    executePayment,
  } = useFluppy();

  // ── Konversi hookLogs (string[]) → LogEntry[] ──────────────────────────────
  const hookLogEntries: LogEntry[] = hookLogs.map((text, i) => {
    const isSuccess = text.includes("✓") || text.includes("SUCCES") || text.includes("SUKSES");
    const isError = text.includes("❌") || text.includes("FAIL") || text.includes("GAGAL");

    const icon = isSuccess
      ? <FiCheckCircle className="text-green-400" />
      : isError
        ? <FiXCircle className="text-red-400" />
        : text.includes("ZKP")
          ? <FiLock className="text-blue-400" />
          : text.includes("Merkle")
            ? <BsCalculator className="text-yellow-400" />
            : text.includes("Stellar")
              ? <FiSend className="text-pink-400" />
              : text.includes("Finance")
                ? <FiDollarSign className="text-emerald-400" />
                : <FiSettings className="text-gray-400" />;

    const kind: LogKind = isSuccess ? "success" : isError ? "error" : "info";

    return { id: i + 1000, icon, text, kind };
  });

  const allLogs = [...localLogs, ...hookLogEntries];
  const done = hookLogs.some(l => l.includes("SUKSES"));

  // ── Cek credential saat wallet connect ────────────────────────────────────
  useEffect(() => {
    if (walletAddress) {
      checkCredentialStatus();
    }
  }, [walletAddress, checkCredentialStatus]);

  // ── Tambah log lokal ──────────────────────────────────────────────────────
  const addLocalLog = useCallback((icon: React.ReactNode, text: string, kind: LogKind = "info") => {
    setLocalLogs(p => [...p, { id: ++idRef.current, icon, text, kind }]);
  }, []);

  // ── Connect wallet ────────────────────────────────────────────────────────
  const handleConnectWallet = async () => {
    try {
      const status = await isConnected();
      if (!status.isConnected) {
        alert("Silakan install Freighter extension!");
        window.open("https://freighter.app", "_blank");
        return;
      }
      await connectWallet();
    } catch (e: any) {
      addLocalLog(
        <FiXCircle className="text-red-400" />,
        `Wallet error: ${e.message}`,
        "error",
      );
    }
  };

  // ── Setup credential baru ─────────────────────────────────────────────────
  const handleSetupCredential = async () => {
    if (!newPassword || newPassword.length < 8) {
      alert("Password minimal 8 karakter");
      return;
    }
    try {
      const secret = await setupCredential(newPassword);
      setSetupSecret(secret);
      addLocalLog(
        <FiKey className="text-pink-400" />,
        "Credential ZK berhasil dibuat!",
        "success",
      );
      addLocalLog(
        <FiShield className="text-yellow-400" />,
        "⚠️  Simpan secret backup di tempat aman!",
        "info",
      );
    } catch (e: any) {
      addLocalLog(
        <FiXCircle className="text-red-400" />,
        `Setup gagal: ${e.message}`,
        "error",
      );
    }
  };

  // ── Execute payment ───────────────────────────────────────────────────────
  const handleRunPayment = async () => {
    if (!walletAddress) {
      alert("Hubungkan wallet Freighter terlebih dahulu!");
      return;
    }
    if (loading) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Jumlah tidak valid!");
      return;
    }
    if (!password) {
      alert("Masukkan password untuk membuka credential!");
      return;
    }

    setLocalLogs([]);
    setTxHash(null);

    await executePayment(amount, destination, password);
  };

  const navItems = [{
    label: "Return to Home",
    bgColor: T.card,
    textColor: "#fff",
    links: [{ label: "Back", href: "/", ariaLabel: "Home" }],
  }];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative min-h-screen antialiased overflow-x-hidden"
      style={{ background: T.bg, color: T.fg }}
    >
      <div className="relative z-10 pt-4">
        <Navbar
          publicKey={walletAddress}
          onConnectWallet={handleConnectWallet}
          items={navItems}
          baseColor="rgba(18, 15, 23, 0.4)"
        />

        <div className="max-w-6xl mx-auto px-6 pt-24 pb-12">

          {/* Judul */}
          <div className="mb-10">
            <h1
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: T.primary }}
            >
              Live DApp
            </h1>
            <h2 className="text-3xl font-bold text-white mt-2">Execute Payment.</h2>
          </div>

          {/* ── Banner: belum punya credential ─────────────────────────── */}
          {walletAddress && credentialStatus === "not_found" && !showSetup && (
            <div className="mb-6 p-6 rounded-2xl border border-yellow-400/30 bg-yellow-400/5">
              <p className="text-sm text-yellow-300 mb-3">
                ⚠️ Kamu belum punya ZK Credential. Buat dulu sebelum bisa bayar.
              </p>
              <button
                onClick={() => setShowSetup(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-black"
                style={{ background: T.primary }}
              >
                <FiUserPlus /> Buat Credential ZK
              </button>
            </div>
          )}

          {/* ── Panel setup credential ─────────────────────────────────── */}
          {showSetup && credentialStatus === "not_found" && (
            <div className="mb-6 p-6 rounded-2xl border border-pink-400/30 bg-pink-400/5 space-y-4">
              <h3 className="text-sm font-bold text-white">Buat ZK Credential Baru</h3>

              <input
                type="password"
                placeholder="Password (min 8 karakter)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
              />

              <button
                onClick={handleSetupCredential}
                className="w-full py-3 rounded-xl font-bold text-black text-sm"
                style={{ background: T.primary }}
              >
                Buat & Enkripsi Credential
              </button>

              {/* Secret backup — tampil SEKALI */}
              {setupSecret && (
                <div className="p-4 rounded-xl bg-black/40 border border-green-400/30">
                  <p className="text-xs text-green-300 mb-2 font-bold">
                    ✓ Secret Backup (simpan sekarang!):
                  </p>
                  <p className="text-xs font-mono text-white break-all">
                    {setupSecret}
                  </p>
                  <p className="text-xs text-yellow-300 mt-2">
                    ⚠️ Secret ini hanya ditampilkan SEKALI. Simpan di tempat aman.
                  </p>
                  <button
                    onClick={() => { setShowSetup(false); setSetupSecret(null); }}
                    className="mt-3 text-xs px-4 py-2 rounded-lg text-black font-bold"
                    style={{ background: T.primary }}
                  >
                    Saya sudah simpan →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Main Grid ──────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* KIRI: FORM */}
            <SolidCard className="p-8 h-full flex flex-col justify-between">
              <div className="space-y-6">

                {/* Password credential */}
                <div>
                  <label
                    className="text-xs font-bold uppercase tracking-widest mb-3 block"
                    style={{ color: T.muted }}
                  >
                    Password ZK Credential
                  </label>
                  <div className="relative">
                    <FiLock className="absolute left-5 top-[18px] text-white/30 text-lg" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Masukkan password credential"
                      style={{ ...inputStyle, paddingLeft: 46, paddingRight: 46 }}
                      onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-5 top-[18px] text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>

                  {/* Status credential */}
                  <p
                    className="text-xs mt-2"
                    style={{
                      color:
                        credentialStatus === "exists"
                          ? "#4ade80"
                          : credentialStatus === "not_found"
                            ? "#f87171"
                            : T.muted,
                    }}
                  >
                    {credentialStatus === "exists" && "✓ Credential ditemukan di perangkat ini"}
                    {credentialStatus === "not_found" && "⚠ Belum ada credential — buat dulu di atas"}
                    {credentialStatus === "unknown" && "Hubungkan wallet untuk cek credential"}
                  </p>
                </div>

                {/* Destination */}
                <div>
                  <label
                    className="text-xs font-bold uppercase tracking-widest mb-3 block"
                    style={{ color: T.muted }}
                  >
                    Destination Address (Merchant)
                  </label>
                  <input
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    placeholder="G... Stellar address"
                    style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
                    onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                    onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                  />
                </div>

                {/* Amount */}
                <div>
                  <label
                    className="text-xs font-bold uppercase tracking-widest mb-3 block"
                    style={{ color: T.muted }}
                  >
                    Amount (USDC)
                  </label>
                  <div className="relative">
                    <FiDollarSign className="absolute left-5 top-[18px] text-white/50 text-lg" />
                    <input
                      type="number"
                      step="0.1"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 42 }}
                      onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                    />
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <div className="mt-10">
                <button
                  onClick={handleRunPayment}
                  disabled={
                    loading ||
                    !password ||
                    !destination ||
                    !amount ||
                    credentialStatus !== "exists"
                  }
                  className="w-full py-4 rounded-xl font-bold text-black transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl flex justify-center items-center gap-2"
                  style={{ background: T.primary }}
                >
                  {loading ? (
                    <>
                      <FiSettings className="animate-spin text-lg" />
                      Executing ZKP...
                    </>
                  ) : done ? (
                    <>
                      <FiRefreshCw className="text-lg" />
                      Pay Again
                    </>
                  ) : (
                    <>
                      <FiShield className="text-lg" />
                      Pay with ZK
                    </>
                  )}
                </button>
              </div>

              {/* Proof Progress */}
              {proofProgress && (
                <div className="mt-4">
                  <ProofProgressBar
                    stage={proofProgress.stage}
                    pct={proofProgress.pct}
                  />
                </div>
              )}
            </SolidCard>

            {/* KANAN: TERMINAL */}
            <TerminalLog logs={allLogs} running={loading} txHash={txHash} />
            {/* Transaction History */}
            <div className="mt-6">
              <TxHistoryPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}