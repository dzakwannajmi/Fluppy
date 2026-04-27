```
# 🚀 Fluppy

Fluppy is a decentralized, non-custodial privacy payment gateway built on **Stellar Soroban**. [cite_start]It empowers users to make private payments using **Zero-Knowledge (ZK) Identity Verification** while enabling merchants to accept payments with an **automated, trustless atomic fee split**[cite: 5].

> [cite_start]**🏆 SCF Instawards Candidate:** This repository is part of the Stellar Community Fund (SCF) submission[cite: 1, 29]. All code is open-source, non-custodial, and engineered for maximum auditability and security.

---

## 🌍 The Problem & Our Innovation

### The Problem
[cite_start]Current payment infrastructures on Soroban lack a standardized mechanism that integrates **identity privacy** with **automated, on-chain revenue sharing**[cite: 8]. [cite_start]Users are frequently required to expose sensitive credentials (like national IDs or student numbers) to third parties just to prove their eligibility for a transaction[cite: 8]. [cite_start]Simultaneously, merchants lack a transparent, instantaneous, and trustless distribution mechanism for protocol margins[cite: 8].

### The Innovation on Stellar
[cite_start]Fluppy decouples **Identity Verification** from **Data Exposure**[cite: 11]. [cite_start]It pioneers the use of **Protocol 25 CAP-0074 (BN254 host functions)** and **Poseidon2 hashing** on Soroban to verify identities using Zero-Knowledge Proofs (ZK-SNARKs)[cite: 5, 25]. [cite_start]Fluppy creates a paradigm shift in the Stellar ecosystem: **100% private identity authorization combined with 100% transparent and atomic on-chain settlement.** [cite: 11]

---

## 🌟 Key Innovations

### 1. Zero-Knowledge Credential Proofs (Circom & Groth16)
[cite_start]Fluppy utilizes **Poseidon2 hashing** and **Groth16 ZK-SNARKs** on the **BN254 curve**[cite: 5, 11]. [cite_start]Users can prove their eligibility (e.g., student ID, membership) locally on their browser without ever exposing their raw credentials or identity on the public ledger[cite: 11, 25].

### 2. Atomic Split Settlements (95/5)
[cite_start]Unlike traditional payment gateways that hold funds, Fluppy executes an **atomic bifurcation** via Soroban[cite: 11]. [cite_start]In a single ledger operation utilizing the Stellar Asset Contract (SAC), 95% of the USDC is routed instantly to the Merchant, while a 5% protocol fee is routed to the Treasury[cite: 5, 11]. No intermediaries, no partial states.

### 3. Cryptographic Field Overflow Protection (BN254 Modulo Wrap Fix)
To synchronize 256-bit SHA-256 hashes with the ~254-bit prime field of the BN254 elliptic curve, Fluppy implements a strict **Byte Masking strategy**. By forcing the first byte of the recipient hash to `0` across both TypeScript and Rust environments, the protocol prevents field overflows and guarantees deterministic cross-platform verification.

---

## 📂 Folder Structure

The repository is structured as a modern full-stack Web3 application:

```text
├── app/                  # Next.js 14 Frontend (UI & Next.js API Routes for ZK)
├── components/           # Reusable UI components (ReactBits, Tailwind, Framer Motion)
├── contracts/            # Rust Smart Contracts (Soroban BN254 Verifier & SAC integration)
├── circuits/             # Circom ZK circuits (Merkle Tree & Groth16 logic)
├── scripts/              # CLI tooling (e.g., test-payment.ts for ZK payload generation)
├── src/lib/              # Core TS logic (Soroban XDR mapping, ZKP generation)
└── Makefile              # Global orchestrator for building, testing, and formatting
```

---

## 🚀 Live Verification (Stellar Testnet)

You can verify the protocol's live execution and atomic split on the Stellar Testnet:

- **Smart Contract ID:** `CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG`
- **Verified ZK Payment (Tx Hash):** [`8cf2dccc38f490a12b6bdcf20bebbf479d5c7b04b251401ad858758737601405`](https://stellar.expert/explorer/testnet/tx/8cf2dccc38f490a12b6bdcf20bebbf479d5c7b04b251401ad858758737601405)
  - *Note: Click the **Events** tab on Stellar.Expert to see the detailed audit logs (Nullifier, Merchant Receive, Protocol Fee).*

---

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) & `stellar-cli`
- [Freighter Wallet](https://freighter.app/) Browser Extension

### 1. Installation & Setup
Clone the repository and install dependencies:
```bash
git clone [https://github.com/dzakwannajmi/Fluppy.git](https://github.com/dzakwannajmi/Fluppy.git)
cd fluppy

# Install frontend dependencies
npm install

# Build the Soroban Smart Contract
soroban contract build
```

### 2. Adding USDC Trustline (Via Stellar.Expert)
To interact with the testnet payment system, your Freighter wallet needs a trustline to the Testnet USDC token.
1. Open [Stellar.Expert Testnet Explorer](https://stellar.expert/explorer/testnet).
2. In the search bar, paste the Testnet USDC Contract ID used in this project: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (or your preferred test USDC).
3. Scroll down and click the **"Add Trustline"** button.
4. Confirm and sign the transaction using your Freighter wallet.
5. Mint/Fund your wallet with testnet USDC.

### 3. Environment Variables
Create a `.env` file in the root directory and configure the following:
```env
NEXT_PUBLIC_CONTRACT_ID=CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG
SENDER_SECRET=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX # Only for terminal CLI testing
```

---

## 💻 Usage & Testing

Fluppy provides two ways to experience the ZK payment pipeline: via Terminal (CLI) and via the Web UI.

### Option A: Running ZK Payment via Terminal (CLI)
For developers who want to see the cryptographic orchestration in real-time. This script computes the Merkle proof, generates the Groth16 SNARK, and submits the XDR payload to Soroban.

```bash
npx tsx script/test-payment.ts
```
**Expected Output:**
```text
🛠️ Generating Proof in Terminal...
🧮 Computing recipient hash & masking modulo limits...
✅ Proof Generated!
🚀 Submitting to Stellar Testnet...
🔄 Mapping ZK Payload to Soroban XDR...
🎉 SUCCESS!
Tx Hash: 8cf2dccc38f490a...
```

### Option B: Running the Web App (UI)
Experience the full-stack privacy payment gateway with Freighter integration.

```bash
npm run dev
```
1. Open `http://localhost:3000` in your browser.
2. Click **Connect Wallet** (Freighter pop-up will appear).
3. Enter a mock NIM (e.g., `2410010454`), Destination Address, and Amount.
4. Watch the Real-time Soroban Exec Shell generate the ZK Proof locally and execute the atomic settlement on-chain!

---

## 🛠 Developer Experience (DX) & Audit Tooling

[cite_start]We provide a **Global Makefile** to streamline building and testing[cite: 25]:

| Command | Action |
| :--- | :--- |
| `make setup` | Installs frontend dependencies and configures Rust toolchain. |
| `make test` | Executes the Soroban unit tests for ZK and financial logic. |
| `make build` | Compiles the smart contract into an optimized WASM binary. |
| `make fmt` | Formats all Rust code to industry standards. |

---

## 🧩 Tech Stack

- [cite_start]**Smart Contracts:** Rust, Soroban SDK [cite: 11]
- [cite_start]**ZK Circuit:** Circom 2.1, SnarkJS, Groth16, Poseidon2, BN254 [cite: 5, 11]
- [cite_start]**Frontend:** Next.js 14, Tailwind CSS, Framer Motion, **ReactBits** [cite: 11]
- [cite_start]**Wallet Integration:** `@stellar/freighter-api` v3 [cite: 11]

## 📜 License

Fluppy is released under the **MIT License**. We believe in open-source privacy infrastructure for the global financial ecosystem.
``` 