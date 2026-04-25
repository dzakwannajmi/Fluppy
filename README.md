-----

# 🚀 Fluppy

Fluppy is a decentralized, non-custodial payment gateway built on **Stellar Soroban**. It empowers merchants to accept payments with **automated fee splitting** while protecting user privacy through **Zero-Knowledge (ZK) Membership Verification**.

> **⚠️ SCF Grant Candidate:** This repository is part of the Stellar Community Fund (SCF) submission. All code is open-source, non-custodial, and designed for auditability.

-----

## 🌟 Key Innovations

### 1\. Zero-Knowledge Membership Proofs

Fluppy uses **Merkle Tree-based ZK verification** to allow users to prove membership in a specific group (e.g., student discounts, loyalty programs) without ever exposing their raw identity on the public ledger.

### 2\. Atomic Split Settlements (95/5)

Unlike traditional systems that require manual billing, Fluppy executes an **atomic bifurcation** of funds. 95% is instantly routed to the Merchant, while a 5% protocol fee is sent to the Treasury in a single, irreversible transaction.

### 3\. Audit-Ready Log Transparency

To comply with financial auditing standards, every transaction emits an **enhanced event** containing:

  - `total_amount` (Gross payment)
  - `merchant_receive` (Net settlement)
  - `protocol_fee` (Calculated revenue)
  - `timestamp` (Ledger-verified time)

-----

## 🛠 Developer Experience (DX) & Audit Tooling

We provide a **Global Makefile** to ensure the project is easy to build, test, and audit by the SCF community and technical reviewers.

| Command | Action |
| :--- | :--- |
| `make setup` | Installs frontend dependencies and configures Rust toolchain. |
| `make test` | Executes the 4/4 passing unit tests for ZK and financial logic. |
| `make build` | Compiles the smart contract into an optimized WASM binary. |
| `make fmt` | Formats all Rust code to industry standards. |

-----

## ⚙️ Technical Architecture

### 🔹 Off-Chain (Privacy Layer)

  - **Merkle Tree Generation**: Identity hashes are organized into a tree.
  - **Proof Generation**: Users generate a 32-byte cryptographic proof locally.

### 🔹 On-Chain (Soroban Logic)

  - **Root Validation**: The contract only stores the **32-byte Merkle Root**, making it impossible to link wallet addresses to real identities.
  - **SAC Integration**: Fully compatible with **Stellar Asset Contracts (USDC)**.

-----

## 🚀 Live Verification (Testnet)

You can verify the protocol's functionality on the Stellar Testnet:

  - **Contract ID**: `CDDVG5GDT7E4HSGKSYFXRSAWEGINCAMOX33THIBVXYUH3R7UE2ET7XY6B`
  - **Successful Tx Proof**: [`8d0be2893ffba4ad7f3...`](https://www.google.com/search?q=%5Bhttps://stellar.expert/explorer/testnet/tx/8d0be2893ffba4ad7f317819b13c69a1bf177e958de8d72d323e5157c62c5657%5D\(https://stellar.expert/explorer/testnet/tx/8d0be2893ffba4ad7f317819b13c69a1bf177e958de8d72d323e5157c62c5657\))
      - *Click the **Events** tab on Stellar Expert to see the detailed audit logs.*

-----

## 📦 Getting Started

### 1\. Installation

```bash
git clone https://github.com/dzakwannajmi/Fluppy.git
cd fluppy
make setup
```

### 2\. Verification & Deployment

```bash
# Run unit tests to verify ZK logic
make test

# Build and Deploy to Testnet (requires stellar-cli)
make deploy
```

-----

## 🧩 Tech Stack

  - **Smart Contracts**: Rust (Soroban SDK)
  - **Frontend**: Next.js 14, Tailwind CSS, Freighter Wallet
  - **Tooling**: Stellar CLI, Makefile
  - **Privacy**: SHA-256 Merkle Proofs

## 📜 License

Fluppy is released under the **MIT License**. We believe in open-source infrastructure for the global financial ecosystem.

-----