# Fluppy Frontend Client 🖥️

This is the frontend repository for the Fluppy Protocol, a web-based interface that allows users to perform privacy-preserving payments using Zero-Knowledge Proofs on the Stellar network.

## 🚀 Key Features

- **Privacy-First (ZKP)**: Real-time Merkle Proof generation using SHA256 (Crypto-JS) on the client side. Validates membership without exposing raw data.
- **Freighter Integration**: Secure non-custodial wallet connection for signing Soroban transactions.
- **Atomic Transaction Handling**: Wraps payment configuration and membership proofs into a single contract invocation.
- **Circuit Breaker Aware**: Built-in protocol pause/unpause functionality for emergency security management.
- **Real-time Polling**: Advanced transaction tracking system that monitors status from `PENDING` to `SUCCESS`.

## 🛠️ Tech Stack

### Smart Contract
- **Language**: Rust
- **Framework**: Soroban SDK
- **Testing**: Cargo Test

### Frontend Client
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS (Fluppy Pink Theme)
- **Blockchain SDK**: @stellar/stellar-sdk
- **Cryptography**: MerkleTreeJS & Crypto-JS
- **Wallet**: @stellar/freighter-api

## ⚙️ Environment Configuration

Make sure you have a `.env.local` file in this folder with the following variables:

```
NEXT_PUBLIC_CONTRACT_ID=PUBLIC_CONTRACT_ID
NEXT_PUBLIC_RPC_URL=[https://soroban-testnet.stellar.org:443](https://soroban-testnet.stellar.org:443)
NEXT_PUBLIC_HORIZON_URL=[https://horizon-testnet.stellar.org](https://horizon-testnet.stellar.org)
NEXT_PUBLIC_USDC_CONTRACT_ID=USDC_CONTRACT_ID
NEXT_PUBLIC_DEV_OPS_WALLET=DEV_OPS_WALLET

````

## 🚦 Getting Started
## Smart Contract

```bash
cd contracts
cargo build --target wasm32v1-none --release
```

## Frontend
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🔒 Security Notes

This protocol adheres to strict privacy standards. The frontend never stores or transmits user identifiers (like NIM) in plain text. All hashing processes are performed locally in the browser before proofs are sent to the Stellar network, ensuring user privacy is preserved from the source.