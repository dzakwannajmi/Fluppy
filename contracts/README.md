# 🦀 Fluppy Smart Contract (Soroban)

This directory contains the core financial logic of the Fluppy protocol. The contract is designed to handle privacy-preserving payments through **Zero-Knowledge Membership Proofs** and automated **USDC atomic splits**.

---

### 🛡️ Security & Engineering Standards

#### **1. Formal Verification through Unit Testing**
The contract includes a comprehensive test suite to ensure state integrity and adversarial resilience.
* **Coverage**: Initialization locks, atomic split precision, and circuit breaker (pause) logic.
* **Execution**: 
  ```bash
  cargo test -- --nocapture
  ```

#### **2. Financial Logic: Atomic Split**
The revenue distribution is hardcoded to ensure a trustless settlement between stakeholders:
$$\text{Merchant Share} = \text{Amount} \times 95\%$$
$$\text{Protocol Fee} = \text{Amount} \times 5\%$$
*Executed as a single atomic operation via the Stellar Asset Contract (SAC) interface.*

#### **3. Privacy Architecture**
Instead of storing sensitive user data, the contract utilizes a **32-byte Merkle Root**. Verification is performed in $O(\log n)$, ensuring that the protocol remains gas-efficient even with a large user whitelist.

---

### 📑 Contract Functions Reference

| Function | Type | Description |
| :--- | :--- | :--- |
| `initialize` | Write | Anchors the Admin, USDC Asset ID, and Treasury address. (One-time only). |
| `pay_with_zk` | Write | Validates ZK-Proof and executes the 95/5 fund bifurcation. |
| `set_pause` | Admin | Triggers the circuit breaker to halt all financial operations. |
| `is_paused` | Read | Returns the current operational status of the protocol. |

---

### 🚀 Technical Prerequisites
* **Toolchain**: `rust-std` wasm32-unknown-unknown.
* **Environment**: Soroban SDK v25.3.1.
* **Optimization**: Built with `release` profile to minimize WASM footprint.

---

---
### ✅ Technical Validation Results
The Fluppy smart contract has undergone rigorous unit testing to ensure financial and logic integrity.

- **Total Tests**: 4
- **Status**: 100% Passed
- **Coverage**:
  1. `test_initialization`: Verifies secure state anchoring.
  2. `test_re_initialization_fails`: Confirms protection against unauthorized state overrides (Security Lock).
  3. `test_successful_atomic_split_payment`: Validates the precision of the 95/5 USDC revenue bifurcation.
  4. `test_circuit_breaker_pause_logic`: Ensures administrative control over protocol operations.
  ---