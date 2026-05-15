//! lib.rs — Fluppy ZK Payment Contract (crate root)
//!
//! Module layout:
//!   lib.rs      → contract entry points, DataKey, shared helpers
//!   errors.rs   → FluppyError enum
//!   payment.rs  → execute_payment logic
//!   verify.rs   → Groth16 verifier (BN254)
//!   test.rs     → unit tests

#![no_std]

// ── Module declarations (REQUIRED — without these, payment.rs cannot
//    use crate::errors / crate::verify / crate::DataKey) ──────────────────
mod errors;
mod payment;
mod verifier; 

#[cfg(test)]
mod test;

// ── Re-exports ────────────────────────────────────────────────────────────
pub use errors::FluppyError;

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, Bytes, BytesN, Env, Vec,
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys
//
// Must be `pub` so payment.rs can access via `crate::DataKey`.
// All storage keys in the entire contract live here — prevents collisions.
// ─────────────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct PauseUpdated {
    pub paused: bool,
}

#[contractevent]
pub struct MerkleRootUpdated {
    pub new_root: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// Admin address — immutable after __constructor.
    Admin,
    /// Stellar Asset Contract address for USDC.
    UsdcToken,
    /// Treasury address — receives 5% protocol fee.
    Treasury,
    /// Fee in basis points (500 = 5.00%). Max 1000 (10%).
    FeePercent,
    /// Circuit-breaker flag. `true` = all payments blocked.
    IsPaused,
    /// Authorised Merkle root (BytesN<32>).
    MerkleRoot,
    /// Spent nullifier registry — keyed by nullifier field element.
    /// Stored in temporary storage. Presence = nullifier is spent.
    Nullifier(BytesN<32>),
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct FluppyContract;

#[contractimpl]
impl FluppyContract {
    // ── One-time initialisation ──────────────────────────────────────────────

    /// Anchors all immutable config on first call.
    /// Panics on any second invocation — re-initialisation attack prevention.
    pub fn __constructor(
        env: Env,
        admin: Address,
        usdc_token: Address,
        treasury: Address,
        merkle_root: BytesN<32>,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage()
            .instance()
            .set(&DataKey::FeePercent, &500_i128);
        env.storage().instance().set(&DataKey::IsPaused, &false);
        env.storage()
            .instance()
            .set(&DataKey::MerkleRoot, &merkle_root);

        // Extend instance TTL: min 90 days, target 300 days
        env.storage().instance().extend_ttl(518_400, 2_592_000);
    }

    // ── Core payment ─────────────────────────────────────────────────────────

    /// ZK-verified USDC payment with atomic 95/5 fee split.
    /// Delegates full pipeline to payment.rs.
    pub fn execute_payment(
        env: Env,
        sender: Address,
        merchant: Address,
        amount: i128,
        pi_a: Bytes,
        pi_b: Bytes,
        pi_c: Bytes,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<(), FluppyError> {
        payment::execute_payment(
            env,
            sender,
            merchant,
            amount,
            pi_a,
            pi_b,
            pi_c,
            public_inputs,
        )
    }

    // ── Admin functions ──────────────────────────────────────────────────────

    /// Pause or unpause all payments. Admin only.
    pub fn set_pause(env: Env, caller: Address, paused: bool) -> Result<(), FluppyError> {
        caller.require_auth();
        require_admin(&env, &caller)?;

        env.storage().instance().set(&DataKey::IsPaused, &paused);

        PauseUpdated { paused }.publish(&env);

        Ok(())
    }

    /// Update the authorised Merkle root (new whitelist snapshot). Admin only.
    pub fn set_merkle_root(
        env: Env,
        caller: Address,
        new_root: BytesN<32>,
    ) -> Result<(), FluppyError> {
        caller.require_auth();
        require_admin(&env, &caller)?;

        env.storage()
            .instance()
            .set(&DataKey::MerkleRoot, &new_root);

        MerkleRootUpdated { new_root }.publish(&env);

        Ok(())
    }

    /// Update the protocol fee in basis points. Max 1000 (10%). Admin only.
    pub fn set_fee(env: Env, caller: Address, fee_bps: i128) -> Result<(), FluppyError> {
        caller.require_auth();
        require_admin(&env, &caller)?;

        if !(0..=1000).contains(&fee_bps) {
            return Err(FluppyError::InvalidAmount);
        }

        env.storage().instance().set(&DataKey::FeePercent, &fee_bps);
        Ok(())
    }

    // ── Read-only queries ────────────────────────────────────────────────────

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsPaused)
            .unwrap_or(false)
    }

    pub fn get_merkle_root(env: Env) -> Option<BytesN<32>> {
        env.storage().instance().get(&DataKey::MerkleRoot)
    }

    /// Returns true if this nullifier was already used in a previous payment.
    pub fn is_nullifier_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .temporary()
            .has(&DataKey::Nullifier(nullifier))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// pub(crate) helpers — shared with payment.rs via crate::
//
// `pub(crate)` = visible inside this crate only, not to external callers.
// payment.rs calls these as:
//   crate::check_not_paused(&env)?;
//   crate::require_admin(&env, &caller)?;
// ─────────────────────────────────────────────────────────────────────────────

/// Returns Err(ContractPaused) if the circuit-breaker is active.
pub(crate) fn check_not_paused(env: &Env) -> Result<(), FluppyError> {
    if env
        .storage()
        .instance()
        .get(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(FluppyError::ContractPaused);
    }
    Ok(())
}

/// Returns Err(NotAdmin) if `caller` is not the stored admin address.
/// Always call after `caller.require_auth()`.
pub(crate) fn require_admin(env: &Env, caller: &Address) -> Result<(), FluppyError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(FluppyError::NotInitialized)?;

    if *caller != admin {
        return Err(FluppyError::NotAdmin);
    }
    Ok(())
}
