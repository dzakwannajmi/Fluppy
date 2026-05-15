//! Shared data types for the Fluppy ZK Payment contract.
//!
//! ## ZKProof format
//! Groth16 proof payload — matches the wire format produced by zkp.ts.
//! Encoding (all big-endian):
//!   pi_a:          BytesN<64>   — G1: x_be32 ‖ y_be32
//!   pi_b:          BytesN<128>  — G2: x_c1_be32 ‖ x_c0_be32 ‖ y_c1_be32 ‖ y_c0_be32
//!   pi_c:          BytesN<64>   — G1: x_be32 ‖ y_be32
//!   public_inputs: Vec<BytesN<32>> — 6 BN254 scalar field elements (SnarkJS order)
//!
//! ## Soroban XDR map ordering (contracttype serialisation rule)
//! Fields in a #[contracttype] struct are serialised as scvMap with keys in
//! LEXICOGRAPHIC order. Alphabetical order of the field names here:
//!   pi_a < pi_b < pi_c < public_inputs   ✓ (already correct)

// NOTE: Do NOT import soroban_sdk::crypto::bn254 — no such module exists
// in the Soroban SDK. BN254 operations are accessed exclusively via:
//   env.crypto().bn254_g1_add(...)
//   env.crypto().bn254_g1_mul(...)
//   env.crypto().bn254_pairing_check(...)
// They operate on plain Bytes values, not on typed structs.

use soroban_sdk::{contracttype, Address, Bytes, BytesN, Vec};

// ─────────────────────────────────────────────────────────────────────────────
// Payment configuration
// ─────────────────────────────────────────────────────────────────────────────

/// Immutable protocol parameters — anchored once during `initialize()`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentConfig {
    /// Stellar Asset Contract address for USDC.
    pub usdc_token:     Address,
    /// Treasury address — receives the 5% protocol fee.
    pub dev_ops:        Address,
    /// Fee in basis points (500 = 5.00%).
    pub fee_percentage: i128,
}

// ─────────────────────────────────────────────────────────────────────────────
// Groth16 proof payload
// ─────────────────────────────────────────────────────────────────────────────

/// Groth16 proof submitted by the client for `pay_with_zk`.
///
/// ⚠ This replaces the old `{ root, proof, leaf }` Merkle path struct.
///   Any caller using the old format will fail — update stellar.ts to use
///   `payWithZkGroth16()` which produces this layout.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ZKProof {
    /// πA — BN254 G1 affine point (64 bytes: x_be32 ‖ y_be32).
    pub pi_a: BytesN<64>,
    /// πB — BN254 G2 affine point (128 bytes: x_c1 ‖ x_c0 ‖ y_c1 ‖ y_c0, all be32).
    pub pi_b: BytesN<128>,
    /// πC — BN254 G1 affine point (64 bytes: x_be32 ‖ y_be32).
    pub pi_c: BytesN<64>,
    /// Six BN254 scalar field elements in SnarkJS output order (each 32 bytes, big-endian):
    ///   [0] nullifier       — circuit output (replay protection tag)
    ///   [1] verifiedRoot    — circuit output (root re-derived inside circuit)
    ///   [2] merkleRoot      — public input   (authorised whitelist root)
    ///   [3] recipientHash   — public input   (hash of `to` address)
    ///   [4] minAmount       — public input   (lower payment bound)
    ///   [5] maxAmount       — public input   (upper payment bound)
    ///
    /// Length MUST equal `verify::N_PUBLIC` (6). `lib.rs` rejects any other count.
    pub public_inputs: Vec<Bytes>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────────────────────

/// All persistent and temporary storage keys used by the contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Admin address — set once during `initialize()`, immutable thereafter.
    Admin,
    /// Payment configuration (`PaymentConfig` struct).
    Config,
    /// Circuit-breaker flag (`bool`).
    IsPaused,
    /// Current authorised Merkle root (`BytesN<32>`).
    /// Updated via `set_merkle_root()` when new members are enrolled.
    MerkleRoot,
    /// Spent nullifier registry — keyed by the nullifier field element.
    /// Stored in `temporary` storage; presence means the nullifier is spent.
    Nullifier(BytesN<32>),
}