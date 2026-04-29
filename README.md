# 🔐 Fluppy Protocol
### Privacy-Preserving Payment Infrastructure on Stellar Soroban

Fluppy is an open-source, non-custodial payment gateway that combines 
**Zero-Knowledge Identity Verification** with **atomic on-chain revenue splitting** 
— built natively on Stellar Soroban using Protocol 25 BN254 host functions.

> 🏆 **SCF Instawards Candidate** | MIT Licensed | Fully Open Source

[![Tests](https://img.shields.io/badge/contract_tests-4%2F4_passing-brightgreen)]()
[![Network](https://img.shields.io/badge/network-Stellar_Testnet-blue)]()
[![ZK](https://img.shields.io/badge/ZK_stack-Groth16%20%2F%20BN254-purple)]()

---

## 🌍 The Problem

Existing payment systems on Soroban have two unresolved gaps:

1. **No privacy-preserving identity layer** — Users must expose raw credentials 
   (national IDs, student numbers) to prove eligibility, which are permanently 
   readable on the public ledger.

2. **No trustless revenue distribution** — Merchants manually split payments 
   off-chain, creating reconciliation overhead and counterparty risk.

Fluppy solves both in a single atomic transaction.

---

## 💡 The Innovation

> **100% private identity authorization + 100% transparent atomic on-chain settlement.**

Fluppy decouples *what you prove* from *what you reveal*.  
Users prove eligibility via a ZK-SNARK. The chain only sees a 32-byte Merkle root — 
never the underlying identity.

---

## 🏗️ Architecture

```
                    ┌─────────────────────────────────────┐
                    │           USER BROWSER               │
                    │                                      │
  NIM / Secret ID ──►  Poseidon2 Hash                     │
                    │       ↓                              │
                    │  Merkle Tree (depth=20)              │
                    │       ↓                              │
                    │  Groth16 Proof (BN254)               │
                    │       ↓                              │
                    │  [π_a, π_b, π_c, public_inputs]      │
                    └────────────┬────────────────────────-┘
                                 │ HTTPS POST
                    ┌────────────▼────────────────────────-┐
                    │        SOROBAN CONTRACT               │
                    │                                      │
                    │  BN254 pairing_check (Protocol 25)   │
                    │       ↓                              │
                    │  Merkle Root Validation              │
                    │       ↓                              │
                    │  Atomic Split via SAC                │
                    │    95% → Merchant                    │
                    │     5% → Protocol Treasury           │
                    └──────────────────────────────────────┘
```

---

## 🌟 Key Technical Contributions

### 1. ZK Membership Proofs (Groth16 / BN254)
- Circuit: Circom 2.1 with **Poseidon2 hashing**
- Proof system: Groth16 — constant-size proof
- On-chain verification: Protocol 25 native host functions

### 2. Atomic 95/5 Fee Split
- Single ledger operation via Stellar Asset Contract (USDC)
- Hardcoded split prevents admin manipulation
- Emits structured audit event

### 3. BN254 Field Overflow Protection
- Byte masking strategy (`hash[0] = 0x00`)
- Ensures deterministic cross-platform verification

### 4. One-Time Initialization Lock
- Prevents re-initialization using storage sentinel
- Ensures immutability post-deployment

---

## 🚀 Live Verification (Stellar Testnet)

| Item | Value |
|------|-------|
| Contract ID | `CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG` |
| Verified ZK Payment | https://stellar.expert/explorer/testnet/tx/8cf2dccc38f490a12b6bdcf20bebbf479d5c7b04b251401ad858758737601405 |
| USDC Contract | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |

---

## ✅ Contract Test Coverage

```
running 4 tests
test test_initialization .......................... ok  
test test_re_initialization_fails ................. ok  
test test_successful_atomic_split_payment ......... ok  
test test_circuit_breaker_pause_logic ............. ok  

test result: ok. 4 passed; 0 failed
```

---

## 📦 Getting Started

### Prerequisites
- Node.js v18+
- Rust + stellar-cli
- Freighter Wallet

### 1. Clone & Install

```bash
git clone https://github.com/dzakwannajmi/Fluppy.git
cd fluppy

cd app && npm install && cd ..

rustup target add wasm32-unknown-unknown
```

### 2. Configure Environment

```bash
cp app/.env.example app/.env.local
```

```env
NEXT_PUBLIC_CONTRACT_ID=CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

### 3. Run Locally

```bash
cd app && npm run dev
```

---

## 🛠 Developer Commands

| Command | Description |
|---------|-------------|
| make setup | Install dependencies |
| make test | Run tests |
| make build | Compile WASM |
| make deploy | Deploy contract |
| make fmt | Format code |
| make clean | Clean artifacts |

---

## 🧩 Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Rust, Soroban SDK |
| ZK Circuits | Circom, SnarkJS, Groth16 |
| ZK Hashing | Poseidon2 |
| Frontend | Next.js 16, Tailwind |
| Wallet | Freighter API |
| Deployment | Vercel |

---

## 🗺️ Roadmap

| Phase | Milestone | Status |
|-------|-----------|--------|
| MVP | Testnet ZK + Split | ✅ |
| V1 | Mainnet Launch | 🔄 |
| V2 | Merchant SDK | 📋 |
| V3 | Multi-credential | 📋 |

---

## 👥 Team

| Role | Contributor |
|------|-------------|
| Protocol Engineer | @dzakwannajmi |

---

## 📁 Structure

```
fluppy/
├── circuits/
├── contracts/
├── app/
├── script/
└── Makefile
```

---

## 📜 License

MIT License