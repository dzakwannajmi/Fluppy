//! FluppyError — all contract error codes.
//!
//! Error code allocation:
//!   1–3:   Lifecycle / initialization errors
//!   4–5:   ZK proof / nullifier errors
//!   6–8:   Business logic / payment constraint errors
//!   9–10:  Access control errors
//!   11:    Circuit-breaker state
//!
//! These codes are returned as Soroban `Error` values and parsed by
//! `parseContractError()` in the frontend's `errorMapper.ts`.
//! ⚠️  Never reorder or reuse a code once deployed — indexers key on them.

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FluppyError {
    /// `__constructor` was called on an already-initialised contract.
    AlreadyInitialized = 1,
    /// A function that requires initialisation was called before `__constructor`.
    NotInitialized = 2,
    /// `public_inputs.len()` ≠ `verify::N_PUBLIC` (6).
    InvalidInputCount = 3,
    /// The nullifier in `public_inputs[0]` has already been spent.
    NullifierSpent = 4,
    /// Groth16 pairing check failed — proof is invalid.
    InvalidProof = 5,
    /// `public_inputs[3]` (recipientHash) ≠ hash of the `merchant` argument.
    RecipientMismatch = 6,
    /// `amount` is zero, negative, or outside the circuit's [minAmount, maxAmount] range.
    AmountOutOfBounds = 7,
    /// Intermediate arithmetic would overflow `i128`.
    ArithmeticOverflow = 8,
    /// `amount` is not a positive integer.
    InvalidAmount = 9,
    /// Caller is not the stored admin address.
    NotAdmin = 10,
    /// Payment rejected because the contract is paused.
    ContractPaused = 11,
    /// `public_inputs[2]` (merkleRoot) ≠ the root stored in contract state.
    RootMismatch = 12,
    /// `public_inputs[1]` (verifiedRoot) ≠ `public_inputs[2]` (merkleRoot).
    /// Indicates the circuit re-derived a different root — proof is internally inconsistent.
    CircuitRootMismatch = 13,
    /// The proof's declared chain ID does not match the current network's chain ID.
    /// Prevents cross-network proof replay (e.g. testnet ↔ mainnet).
    ChainIdMismatch = 17,
}
