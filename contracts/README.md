# 🦀 Fluppy Smart Contract (Soroban)

> **Testnet Notice:** This contract is deployed on Stellar Testnet. The ZK verifier
> is a testnet stub. Do not use for real financial transactions. See [`SECURITY.md`](../SECURITY.md).

This directory contains the on-chain logic of the Fluppy protocol: ZK membership
verification, atomic USDC fee splitting, and circuit breaker controls — built with
Soroban SDK v25.3.1.

---

## 📁 Module Structure

```
contracts/src/
├── lib.rs        # Entry point — contract functions, event emission, auth flow
├── payment.rs    # 95/5 atomic split calculation
├── verify.rs     # ZK membership verifier (Merkle root check)
├── types.rs      # ZKProof, PaymentConfig, DataKey structs
├── errors.rs     # FluppyError enum (6 typed error codes)
└── test.rs       # 4 unit tests — initialization, split, pause, security lock
```

---

## 📐 On-Chain Data Structures

### `ZKProof` — Caller-Supplied Proof Payload

```rust
pub struct ZKProof {
    pub root:  BytesN<32>,
    pub proof: Vec<BytesN<32>>,
    pub leaf:  BytesN<32>,
}
```

### `PaymentConfig` — Immutable Protocol Configuration

```rust
pub struct PaymentConfig {
    pub usdc_token:     Address,
    pub dev_ops:        Address,
    pub fee_percentage: i128,
}
```

### `DataKey` — Storage Key Enum

```rust
pub enum DataKey {
    Admin,
    IsPaused,
    Config,
}
```

---

## 📋 Contract Functions

| Function | Access | Description |
|---|---|---|
| `initialize(admin, usdc_token, dev_ops)` | One-time only | Anchors admin, USDC SAC, and treasury address into immutable storage |
| `pay_with_zk(from, to, amount, zk_proof)` | Public | Verifies ZK proof and executes atomic 95/5 split |
| `set_pause(admin, is_paused)` | Admin only | Enables/disables circuit breaker |
| `is_paused()` | Read-only | Returns pause state |

---

## 🔄 `pay_with_zk` Execution Flow

```
Caller submits: { from, to, amount, zk_proof }
        │
        ▼
1. check_if_paused()
        │
        ▼
2. verify_membership()
        │
        ▼
3. calculate_split()
        │
        ▼
4. from.require_auth()
        │
        ▼
5. token.transfer → merchant (95%)
   token.transfer → treasury (5%)
        │
        ▼
6. emit PayZkEvent
```

---

## 📡 Event Schema

### `PayZkEvent`

```rust
pub struct PayZkEvent {
    pub from:             Address,
    pub merchant:         Address,
    pub total_amount:     i128,
    pub merchant_receive: i128,
    pub protocol_fee:     i128,
    pub timestamp:        u64,
}
```

### `PauseStatusEvent`

```rust
pub struct PauseStatusEvent {
    pub is_paused: bool,
}
```

---

## ⚠️ Error Codes

| Code | Meaning |
|---|---|
| #1 | UnauthorizedMember |
| #2 | InsufficientBalance |
| #3 | ContractPaused |
| #4 | NotAdmin |
| #5 | InvalidPaymentAmount |
| #6 | Overflow |

---

## 🛡️ Security Design

### Immutable Initialization
- Contract config locked after first deployment

### Atomic 95/5 Split
```
merchant = 95%
treasury = 5%
```

### Privacy
- No identity stored on-chain
- Only Merkle root + proof

### ZK Complexity
- On-chain verification: **O(1)**
- Off-chain Merkle path: **O(depth)**

---

## ⚠️ Known Limitations

- Nullifier not implemented → replay attack possible
- Verifier is stub → no real pairing check yet

See `SECURITY.md` for full details.

---

## ✅ Tests

```
4 tests — all passing
```

- Initialization lock
- Re-init failure
- Payment split
- Pause logic

---

## 🚀 Commands

```bash
make build
make test
make deploy
```

---

## 🔗 Live

| Item | Value |
|---|---|
| Contract | CB3OW27PKHMRL4JAWU5NKLFIFVUSDNIP7VOTUGCUM5E66BPO5HYTCORG |
| Tx | https://stellar.expert/explorer/testnet/tx/8cf2dccc38f490a12b6bdcf20bebbf479d5c7b04b251401ad858758737601405 |

---

## 📜 License

MIT