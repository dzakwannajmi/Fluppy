# 💻 Fluppy — Frontend Application (`/app`)

This directory contains the Next.js web interface for the Fluppy Protocol.
It handles client-side ZK proof generation, Freighter wallet integration,
and Soroban transaction submission for the `pay_with_zk` contract function.

> **Testnet Notice:** This application connects to Stellar Testnet only.
> The ZK verifier is a testnet build. See [`../SECURITY.md`](../SECURITY.md)
> for known limitations before using in any financial context.

---

## 📁 Directory Structure

```
app/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Main payment UI (NIM input, amount, wallet)
│   │   ├── layout.tsx         # Root layout with COOP/COEP security headers
│   │   └── globals.css        # Global styles
│   ├── components/            # UI components (SuccessReceipt, animations)
│   ├── hooks/
│   │   └── useFluppy.ts       # Core hook — wallet, ZKP, payment orchestration
│   └── lib/
│       ├── zkp.ts             # ZK proof generation (Noir + Barretenberg)
│       ├── stellar.ts         # Soroban XDR encoding + transaction submission
│       └── errorMapper.ts     # Contract error code → user-friendly messages
├── public/
│   └── circuit.json           # Compiled Noir circuit (bytecode + ABI)
├── next.config.ts             # COOP/COEP headers, WASM config, CSP policy
└── package.json
```

---

## 🔄 Payment Flow

```
User enters NIM + merchant address + amount
        │
        ▼
1. useFluppy.ts → generateZkProof(nimSecret, WHITELIST)
        │
        ▼
2. zkp.ts → Poseidon2 hash of each whitelist entry
            → Merkle path computation (depth 10)
            → Noir circuit execution (witness generation)
            → Barretenberg proof generation (BN254)
        │
        ▼
3. stellar.ts → Map proof to Soroban ScVal (scvBytes)
               → Build pay_with_zk transaction via stellar-sdk
               → Request Freighter wallet signature
               → Submit to Soroban RPC
        │
        ▼
4. useFluppy.ts → Poll for transaction finality
                → Emit timestamped log entries
                → Display tx hash on success
```

---

## 🧩 Technical Stack

| Layer | Library | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.3 |
| Language | TypeScript | 5.x |
| ZK Proving | `@noir-lang/backend_barretenberg` | Noir 1.0.0-beta.19 |
| ZK Circuit | `@noir-lang/noir_js` | Noir 1.0.0-beta.19 |
| ZK Hashing | `poseidon-lite` (Poseidon2, BN254) | latest |
| Blockchain SDK | `@stellar/stellar-sdk` | 15.0.1 |
| Wallet | `@stellar/freighter-api` | 6.0.1 |
| UI Animation | `framer-motion` / `motion` | latest |
| Styling | Tailwind CSS | 3.x |
| Notifications | `react-hot-toast` | latest |

---

## ⚙️ Environment Configuration

Create `app/.env.local` (this file is gitignored — never commit it):

```env
NEXT_PUBLIC_CONTRACT_ID=CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

**Why only 4 variables?** The contract's treasury address (`dev_ops`) and USDC
token address are stored inside the Soroban contract's `PaymentConfig` instance
storage, set permanently at initialization. The payment split is enforced on-chain
— these values are never passed from the frontend.

---

## 🛠️ Local Setup

### Prerequisites

- Node.js **v20.0.0 or higher** (required by `@stellar/stellar-sdk@15`)
- Freighter Wallet browser extension, configured for **Testnet**

### Installation

```bash
cd app
npm install
```

### Development Server

```bash
npm run dev
# → http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

---

## 🔑 Key Source Files

### `src/lib/zkp.ts` — ZK Proof Generation

- Runs entirely client-side (`'use client'`)
- Fetches compiled circuit from `/public/circuit.json`
- Uses Poseidon2 hashing via `poseidon-lite`
- Builds Merkle tree and computes membership path
- Executes Noir circuit and generates BN254 proof via Barretenberg

### `src/lib/stellar.ts` — Soroban Integration

- Encodes proof into Soroban `ScVal` (XDR)
- Applies BN254 overflow protection (`hash[0] = 0x00`)
- Builds and submits `pay_with_zk` transaction
- Uses RPC polling for confirmation

### `src/hooks/useFluppy.ts` — Orchestration

- Handles wallet connection (Freighter)
- Executes full ZKP → transaction pipeline
- Maintains execution logs
- Maps contract errors to UI messages

### `src/lib/errorMapper.ts` — Error Mapping

| Contract Error | Message |
|---|---|
| `Error(Contract, #1)` | Identity not authorized |
| `Error(Contract, #2)` | Insufficient balance |
| `Error(Contract, #3)` | Protocol paused |
| `Error(WasmVm, InvalidAction)` | Already initialized |

---

## 🔒 Security Architecture

### Cross-Origin Isolation

```ts
{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
{ key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
```

### Content Security Policy

Uses `wasm-unsafe-eval` for WASM support (not `unsafe-eval`).

### Identity Privacy

- Identity never leaves browser
- Only ZK proof sent on-chain
- No raw credential stored anywhere

### Whitelist

- Hardcoded for testnet
- Future: dynamic Merkle root updates

---

## 📺 Verified Evidence

| Item | Link |
|---|---|
| Contract | `CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG` |
| Transaction | https://stellar.expert/explorer/testnet/tx/8cf2dccc38f490a12b6bdcf20bebbf479d5c7b04b251401ad858758737601405 |
| Live App | https://fluppy.vercel.app |
| GitHub | https://github.com/dzakwannajmi/Fluppy |
| Demo | *(https://fluppy.vercel.app/)* |

---

## 📜 License

MIT