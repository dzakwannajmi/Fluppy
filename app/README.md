Ini adalah draf **README.md** untuk folder `app` (frontend) yang telah diperbarui dengan standar teknis tinggi. [cite_start]Dokumentasi ini secara eksplisit menjelaskan arsitektur keamanan kamu di mana parameter finansial disimpan secara *on-chain* untuk mencegah manipulasi[cite: 19].

-----

# 💻 Fluppy Client Interface (Application Layer)

[cite_start]This directory contains the high-performance web dashboard for the **Fluppy Protocol**, a **Layer 3 application layer** solution built on the **Stellar Testnet**[cite: 7]. [cite_start]The interface serves as a non-custodial gateway, allowing users to interact with Soroban smart contracts through the **Freighter** wallet[cite: 14].

## 🚀 Technical Features

  * [cite_start]**Client-Side ZKP Generation**: Leverages `MerkleTreeJS` to generate cryptographic membership proofs locally[cite: 14]. [cite_start]This ensures that sensitive identifiers never leave the user's device, maintaining absolute data sovereignty[cite: 9].
  * [cite_start]**On-Chain Parameter Anchoring**: Following a security-first approach, this client does not store treasury or asset IDs in local environment variables[cite: 19]. [cite_start]Instead, it fetches these immutable parameters directly from the smart contract's storage to prevent unauthorized redirection of funds[cite: 19].
  * [cite_start]**Atomic USDC Settlement**: Facilitates the instantaneous bifurcation of funds—distributing 95% to the merchant and 5% to the protocol treasury in a single, atomic operation on the Stellar Ledger[cite: 14].
  * [cite_start]**Deterministic XDR Serialization**: Implements precise mapping of JavaScript objects to **Soroban-compliant ScVal** (XDR) formats, ensuring data integrity during the `pay_with_zk` contract invocation[cite: 14].
  * [cite_start]**Real-Time Finality Monitoring**: Includes an asynchronous polling engine that tracks transaction status from submission to ledger finality, providing users with immediate feedback[cite: 14, 19].

## 🛠️ Technical Stack

  * [cite_start]**Framework**: Next.js 14 (App Router) with TypeScript[cite: 14].
  * [cite_start]**Blockchain Integration**: `@stellar/stellar-sdk` & `@stellar/freighter-api`[cite: 14].
  * **Cryptography**: SHA-256 hashing and Merkle Tree construction via `merkletreejs`.
  * **Infrastructure**: Soroban RPC & Horizon Server connectivity.

## ⚙️ Environment Configuration

To ensure secure connectivity, configure your `.env.local` file with the following network parameters. [cite_start]Note that **DevOps Wallet** and **USDC ID** are excluded here as they are securely anchored within the smart contract to mitigate tampering risks[cite: 19].

```env
# Network Connectivity & Contract Identification
NEXT_PUBLIC_CONTRACT_ID=CBBM6MKF3S74Y7FSRBZZJRD5KNIYCTDG5FSWHFHYXYC2DBMMJEFL2NH5
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

## 🚦 Installation and Deployment

### 📦 Prerequisites

  * Node.js v18.0.0 or higher.
  * Freighter Wallet extension configured for **Testnet**.

### 🛠️ Local Development

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Launch Development Server**:
    ```bash
    npm run dev
    ```
3.  **Access the Dashboard**: Navigate to [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000).

## 🔒 Security Architecture: Tamper-Proof Routing

[cite_start]Unlike standard dApps that rely on centralized `.env` files for treasury routing, Fluppy utilizes **Immutable Contract Storage**[cite: 19]. [cite_start]By invoking parameters stored on-chain, the frontend ensures that even if the application layer is compromised, the automated 95/5 revenue split remains cryptographically enforced and unalterable[cite: 11, 14].

## 📺 Evidence of Execution

  * [cite_start]**Verifiable Transaction**: Tx Hash `c4dbc5baeb0b8fb4f7975fd73234a44d1b0e716d1baab5a79076132a7d73180c4` demonstrates successful ZKP validation and USDC bifurcation[cite: 23].
  * [cite_start]**Technical Repository**: [Link to GitHub Repo][cite: 23].
  * [cite_start]**Demo Walkthrough**: [3-5 Minute Video Link][cite: 23].

## 📜 License

This frontend client is open-source and released under the **MIT License**.