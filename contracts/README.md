# 🔐 Security Policy — Fluppy Protocol

## Overview

Fluppy is a privacy-preserving payment protocol on Stellar Soroban that combines
Zero-Knowledge Membership Proofs with atomic USDC settlement. This document describes
the security model, implemented protections, known limitations, threat model, and
responsible disclosure policy.

> ⚠️ **Testnet Status Notice**
> Fluppy is currently deployed on Stellar Testnet only. The on-chain ZK verifier
> is a testnet implementation. Do NOT use this protocol for real financial transactions
> until the mainnet audit is complete and this notice is removed.

---

## 1. Implemented Security Controls

### 1.1 One-Time Initialization Lock

The `initialize()` function uses a sentinel storage key to prevent re-initialization.
Any attempt to call it a second time triggers an immediate `panic!`, making the
treasury address, USDC asset ID, and admin address permanently immutable after
the first deployment.

```rust
if env.storage().instance().has(&DataKey::Config) {
    panic!("Contract already initialized");
}
```

**Guarantee:** Protocol treasury routing cannot be redirected post-deployment,
even by the contract admin.

### 1.2 Caller Authentication (`require_auth`)

Every `pay_with_zk` invocation requires the `from` address to sign the transaction
via Freighter. This is enforced by Soroban's native `Address::require_auth()` before
any fund transfer occurs.

```rust
from.require_auth();
```

**Guarantee:** A third party cannot submit a payment on behalf of a user without
explicit wallet signature.

### 1.3 Circuit Breaker (Emergency Pause)

An admin-controlled pause mechanism halts all `pay_with_zk` operations without
requiring contract redeployment. The `is_paused` state is checked as the first
operation in every payment flow.

```rust
check_if_paused(&env)?;
```

### 1.4 Hardcoded 95/5 Split

The revenue split is hardcoded at compile time — not configurable via parameters.

```rust
let merchant_amt = (amount * 95) / 100;
let treasury_amt = amount - merchant_amt;
```

### 1.5 Off-Chain Identity Isolation

No raw user identity is stored on-chain. Only a Merkle root is recorded.

### 1.6 Structured Error Codes

```rust
pub enum FluppyError {
    UnauthorizedMember = 1,
    InsufficientBalance = 2,
    ContractPaused = 3,
    NotAdmin = 4,
    InvalidPaymentAmount = 5,
    Overflow = 6,
}
```

---

## 2. Known Limitations (Testnet Phase)

### 2.1 ⚠️ Nullifier Not Implemented (HIGH)

Replay attacks are currently possible.

**Planned fix:**

```rust
if env.storage().persistent().has(&DataKey::Nullifier(zk_proof.nullifier.clone())) {
    return Err(FluppyError::NullifierAlreadyUsed);
}
env.storage().persistent().set(
    &DataKey::Nullifier(zk_proof.nullifier.clone()),
    &true
);
```

---

### 2.2 ⚠️ Verifier Stub (HIGH)

ZK proofs are not cryptographically verified on-chain.

**Planned fix:**

```rust
bn254::pairing_check(env, &[...])
```

---

### 2.3 ⚠️ Static Whitelist (MEDIUM)

Hardcoded whitelist.

---

### 2.4 ℹ️ Serialization Risks (LOW)

Edge cases in proof encoding still under testing.

---

## 3. Threat Model

### Assets

| Asset | Protection |
|---|---|
| Funds | require_auth |
| Identity | Off-chain |
| Treasury | Immutable |
| Availability | Pause |

### Trust Boundary

```
UNTRUSTED → TRUSTED
User input → Contract verification
Proof → On-chain logic
```

### Threats

| Threat | Status |
|---|---|
| Replay | ❌ |
| Forgery | ❌ |
| Front-run | ✅ |
| Overflow | ✅ |

---

## 4. ZK Security Properties

- Merkle membership proof only
- No payment logic in circuit
- Poseidon2 hashing (BN254)

---

## 5. Test Coverage

```
4 tests — all passing
```

Gaps:
- No replay test
- No pairing test

---

## 6. Mainnet Checklist

- [ ] Nullifier
- [ ] Pairing check
- [ ] Audit
- [ ] Root update
- [ ] Replay protection

---

## 7. Disclosure

**Email:** repmoonasci@gmail.com  
Response within 48 hours.

---

## 8. Changelog

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2025-04-29 | Initial |

---