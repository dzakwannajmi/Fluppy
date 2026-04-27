# 🚀 Fluppy Protocol

Fluppy is a decentralized, non-custodial privacy payment gateway built on **Stellar Soroban**.  
It empowers users to make private payments using **Zero-Knowledge (ZK) Identity Verification** while enabling merchants to accept payments with an **automated, trustless atomic fee split**.

> 🏆 **SCF Instawards Candidate:** This repository is part of the Stellar Community Fund (SCF) submission. All code is open-source, non-custodial, and engineered for maximum auditability and security.

---

## 🌍 The Problem & Our Innovation

### The Problem
Current payment infrastructures on Soroban lack a standardized mechanism that integrates **identity privacy** with **automated, on-chain revenue sharing**.  

Users are frequently required to expose sensitive credentials (like national IDs or student numbers) to third parties just to prove eligibility for a transaction.  

At the same time, merchants lack a transparent, instantaneous, and trustless mechanism for distributing protocol revenue.

---

### The Innovation on Stellar
Fluppy decouples **Identity Verification** from **Data Exposure**.

It leverages **Protocol 25 CAP-0074 (BN254 host functions)** and **Poseidon2 hashing** on Soroban to verify identities using **Zero-Knowledge Proofs (ZK-SNARKs)**.

This creates a new paradigm:

> **100% private identity authorization combined with 100% transparent and atomic on-chain settlement.**

---

## 🌟 Key Innovations

### 1. Zero-Knowledge Credential Proofs (Circom & Groth16)
Fluppy utilizes **Poseidon2 hashing** and **Groth16 ZK-SNARKs** on the **BN254 curve**.

Users can prove eligibility (e.g., student ID, membership) locally in their browser without exposing raw credentials or identity on-chain.

---

### 2. Atomic Split Settlements (95/5)
Unlike traditional payment gateways, Fluppy executes an **atomic split transaction** via Soroban.

In a single ledger operation:
- 95% → Merchant  
- 5% → Protocol Treasury  

No intermediaries. No partial states.

---

### 3. Cryptographic Field Overflow Protection (BN254 Modulo Wrap Fix)
To align 256-bit SHA-256 hashes with the ~254-bit BN254 field, Fluppy implements a strict **byte masking strategy**.

By forcing the first byte of the recipient hash to `0` across both TypeScript and Rust:
- Prevents field overflow  
- Ensures deterministic cross-platform verification  

---

## 📂 Folder Structure

```text
├── app/                  # Next.js 14 Frontend (UI & API routes for ZK)
├── components/           # Reusable UI components (ReactBits, Tailwind, Motion)
├── contracts/            # Rust Smart Contracts (Soroban verifier & SAC integration)
├── circuits/             # Circom ZK circuits (Merkle Tree & Groth16 logic)
├── scripts/              # CLI tools (ZK proof & test payments)
├── src/lib/              # Core TS logic (ZKP, Soroban XDR mapping)
└── Makefile              # Build, test, and dev orchestration
```

---

## 🚀 Live Verification (Stellar Testnet)

- **Smart Contract ID**  
  `CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG`

- **Verified ZK Payment (Tx Hash)**  
  https://stellar.expert/explorer/testnet/tx/8cf2dccc38f490a12b6bdcf20bebbf479d5c7b04b251401ad858758737601405

> Open the **Events tab** on Stellar Expert to view audit logs (Nullifier, Merchant Receive, Protocol Fee).

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- Rust + `stellar-cli`
- Freighter Wallet (browser extension)

---

### 1. Installation

```bash
git clone https://github.com/dzakwannajmi/Fluppy.git
cd fluppy

npm install
stellar contract build
```

---

### 2. Add USDC Trustline

1. Open https://stellar.expert/explorer/testnet  
2. Search Contract ID:
   ```
   CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
   ```
3. Click **Add Trustline**
4. Confirm via Freighter
5. Fund wallet with testnet USDC

---

### 3. Environment Variables

Create `.env`:

```env
NEXT_PUBLIC_CONTRACT_ID=CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG
SENDER_SECRET=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 💻 Usage

### Option A: CLI (ZK Payment)

```bash
npx tsx script/test-payment.ts
```

**Output:**
```text
🛠️ Generating Proof...
🧮 Computing hash...
✅ Proof Generated!
🚀 Submitting...
🎉 SUCCESS!
Tx Hash: 8cf2dccc...
```

---

### Option B: Web App

```bash
npm run dev
```

Steps:
1. Open http://localhost:3000  
2. Connect Freighter Wallet  
3. Input:
   - NIM (e.g., 2410010454)
   - Destination Address
   - Amount  
4. Execute transaction with real-time ZK proof generation  

---

## 🛠 Developer Experience (DX)

| Command | Description |
|--------|------------|
| `make setup` | Setup dependencies & toolchain |
| `make test` | Run smart contract tests |
| `make build` | Compile optimized WASM |
| `make fmt` | Format Rust code |

---

## 🧩 Tech Stack

- **Smart Contracts:** Rust, Soroban SDK  
- **ZK Stack:** Circom 2.1, SnarkJS, Groth16, Poseidon2, BN254  
- **Frontend:** Next.js 14, Tailwind CSS, Framer Motion, ReactBits  
- **Wallet:** @stellar/freighter-api v3  

---

## 📜 License

MIT License — open-source privacy infrastructure for global finance.