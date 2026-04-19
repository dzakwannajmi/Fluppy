# Fluppy

Fluppy is a decentralized payment protocol built on the Stellar Soroban ecosystem.  
It enables **automatic split payments without intermediaries**, while preserving user privacy using **Zero-Knowledge Proof (ZKP)-inspired mechanisms**.

---

## 💡 Problem & Solution

### ❌ Problem

In traditional group payments or membership-based discounts, users are often required to expose sensitive identity information (such as student IDs or membership numbers) to centralized systems or even directly on-chain.

This creates serious privacy risks:
- Identity data can be permanently linked to wallet addresses
- Sensitive information may be exposed to internal systems or third parties
- No privacy guarantees in public ledgers

---

### ✅ Solution

Fluppy introduces a **Zero-Knowledge Membership Verification layer** using:

- Merkle Trees  
- SHA256 hashing  

Users can prove they belong to a valid group (e.g., university students) **without revealing their actual identity (e.g., student ID)**.

---

## 🛠 Technical Architecture

Fluppy uses a hybrid architecture to ensure efficiency and privacy:

### 🔹 Off-Chain Layer
- User identities are hashed into a **Merkle Tree**
- A **Merkle Proof** is generated as a cryptographic membership proof

### 🔹 On-Chain Layer (Soroban)
- The smart contract stores only a **32-byte Merkle Root**
- No raw identity data is stored on-chain
- Reduces storage costs and enhances privacy

### ⚡ Execution Flow
- The contract verifies proofs in **O(log n)**
- If valid:
  - Payment is processed
  - Funds are split automatically
- All executed in a single **atomic transaction**

---

## ⚙️ Features

- ✅ Trustless split payments (95% receiver, 5% protocol)
- ✅ Privacy-preserving membership verification
- ✅ No sensitive data stored on-chain
- ✅ Atomic execution via Soroban smart contracts
- ✅ Open-source and reusable infrastructure

---

## 📈 Development Milestones

### 🧱 Phase 1: Core Smart Contract
- Implemented split-payment logic in Rust
- Automatic fund distribution (95% receiver / 5% DevOps)
- Custom error handling:
  - `UnauthorizedMember`
  - `InsufficientBalance`

---

### 🔐 Phase 2: ZKP Integration (Merkle-based)
- Implemented Merkle Tree verification using SHA256
- Synced hashing between:
  - Frontend (Crypto-JS)
  - Smart Contract (`env.crypto`)
- Ensured full cryptographic consistency

---

### 🌐 Phase 3: Frontend & Wallet Integration
- Built responsive UI using **Next.js 14 + Tailwind CSS**
- Integrated **Freighter Wallet** for secure transaction signing
- Implemented real-time transaction polling via Soroban RPC

---

### 🛡 Phase 4: Security Testing
- Conducted positive & negative tests
- Validated resistance against unauthorized access
- Ensured protocol robustness

---

## 🧪 Technical Test Results

### 1. 🔍 Soundness Test (Negative Case)

**Scenario:** Invalid identity claim (non-whitelisted user)

- Input: Unauthorized membership (fake ID)
- Result: Execution halted with `Error(Contract, #1)`

✅ **Conclusion:**  
The protocol correctly rejects unauthorized users.

---

### 2. 🔐 Privacy Test

- No raw identity data is visible on-chain
- Only:
  - Merkle Leaf
  - Proof
  - Root (hashed data)

✅ **Conclusion:**  
User identity remains fully private and unlinkable.

---

## 🚀 Getting Started

### 📦 Prerequisites

- Rust & Cargo (v1.84+)
- Stellar CLI
- Node.js & npm

---

### 📥 Installation

```bash
git clone https://github.com/m-dzakwan/fluppy.git
cd fluppy
npm install
````

---

### 🦀 Build Smart Contract

```bash
cd contracts

RUSTFLAGS="-C target-feature=-reference-types,-multi-value" \
cargo build --target wasm32v1-none --release
```

---

### 🚀 Deploy Contract

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/fluppy.wasm \
  --source anymous \
  --network testnet
```

---

## 🧩 Tech Stack

* **Smart Contract:** Rust (Soroban)
* **Frontend:** React (Next.js / TSX)
* **Backend:** Node.js + PostgreSQL
* **Cryptography:** SHA256, Merkle Trees
* **Wallet:** Freighter

---

## 🌍 Vision

Fluppy aims to become a **privacy-first payment infrastructure** for real-world applications:

* Hospitality (hotel payments)
* Membership-based services
* Group payments
* Loyalty systems

---

## 📜 License
This project is open-source and available under the MIT License.