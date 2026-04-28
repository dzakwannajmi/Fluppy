"use client";

import React from "react";
import { FiGithub, FiBook, FiGlobe } from "react-icons/fi";

const T = {
  muted: "#94a3b8",
  primary: "#FF85BB",
  border: "rgba(255,255,255,0.08)",
};

export default function Footer() {
  return (
    <footer className="relative pt-16 pb-12 px-6 z-10" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="max-w-6xl mx-auto">

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">

          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-[4px] flex items-center justify-center" style={{ background: T.primary }}>
              <span className="text-black text-[10px] font-black">✦</span>
            </div>
            <span className="font-bold tracking-widest text-white">FLUPPY</span>
          </div>

          <div className="flex items-center gap-8 text-sm font-medium">
            <a href="https://github.com/dzakwannajmi/Fluppy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-[#FF85BB]" style={{ color: T.muted }}>
              <FiGithub className="text-lg" /> GitHub
            </a>
            <a href="#docs" className="flex items-center gap-2 transition-colors hover:text-[#FF85BB]" style={{ color: T.muted }}>
              <FiBook className="text-lg" /> Docs
            </a>
            <a href="https://stellar.expert/explorer/testnet" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-[#FF85BB]" style={{ color: T.muted }}>
              <FiGlobe className="text-lg" /> Explorer
            </a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 text-xs font-mono uppercase tracking-widest" style={{ borderTop: `1px solid ${T.border}`, color: "rgba(255,255,255,0.3)" }}>
          <span>© 2026 Fluppy Protocol</span>

          <div className="flex flex-wrap justify-center gap-3">
            <span>Stellar</span>
            <span style={{ color: T.primary }}>·</span>
            <span>Soroban</span>
            <span style={{ color: T.primary }}>·</span>
            <span>ZK-SNARKs</span>
            <span className="ml-2 px-2 py-0.5 rounded-sm" style={{ border: `1px solid ${T.border}`, color: T.muted }}>
              v1.0.4
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}