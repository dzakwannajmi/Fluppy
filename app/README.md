# Fluppy Frontend Client 🖥️

This is the frontend repository for the Fluppy Protocol, a web-based interface that allows users to perform privacy-preserving payments using Zero-Knowledge Proofs on the Stellar network.

## 🚀 Key Features

- **Freighter Integration**: Secure non-custodial wallet connection for signing Soroban transactions.
- **On-the-fly ZKP Generation**: Real-time Merkle Proof generation on the client side using SHA256 (Crypto-JS).
- **Atomic Transaction Handling**: Wraps payment configuration and membership proofs into a single contract invocation.
- **Real-time Polling**: Transaction status tracking system from PENDING to SUCCESS using Soroban RPC.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
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

## 🏗️ Folder Structure

- `app/page.tsx`: Main logic for ZKP integration and UI Dashboard.
- `app/globals.css`: Configuration for "Fluppy" theme and color variables.
- `public/`: Static assets and icons.

## 🚦 Running in Development


```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🔒 Security Notes

This frontend never stores user NIM (Student ID) in plain text. All hashing processes are performed locally in the browser before proofs are sent to the Stellar network, ensuring user privacy is preserved from the source.
