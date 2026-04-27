#![no_std]

mod payment;

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env};

// ─── Shared storage key enum ──────────────────────────────────────────────────
// Single enum covers all modules — prevents storage key collisions.
// Source: security.md §5 — typed enum for collision-free keys.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // instance storage — immutable after __constructor
    Admin,
    UsdcToken,
    Treasury,
    // persistent storage — one entry per nullifier
    Nullifier(soroban_sdk::BytesN<32>),
}

// ─── Contract errors ──────────────────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FLuppyError {
    AlreadyInitialized    = 1,
    NotInitialized        = 2,
    InvalidInputCount     = 3,
    NullifierSpent        = 4,
    InvalidProof          = 5,
    RecipientMismatch     = 6,
    AmountOutOfBounds     = 7,
    ArithmeticOverflow    = 8,
    InvalidAmount         = 9,
}

// ─── Contract ─────────────────────────────────────────────────────────────────
#[contract]
pub struct FluppyContract;

#[contractimpl]
impl FluppyContract {

    /// One-time initialization. Panics on any second call.
    /// Source: security.md §2 — reinitialization attack prevention.
    /// Source: contracts-soroban.md — constructor / guarded initialize pattern.
    pub fn __constructor(
        env: Env,
        admin:      Address,
        usdc_token: Address,
        treasury:   Address,
    ) {
        // Fail fast — reject before touching any storage.
        // Source: security.md §2 — "check for admin existence" pattern.
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        // Admin must sign the deployment transaction.
        // Source: security.md §1 — explicit authorization for privileged ops.
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin,     &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Treasury,  &treasury);

        // Extend instance TTL to ~300 days.
        // Source: contracts-soroban.md — TTL management, prevent archival.
        env.storage().instance().extend_ttl(518400, 5184000);
    }

    /// Execute a ZK-verified payment. Delegates to payment module.
    pub fn execute_payment(
        env:           Env,
        sender:        Address,
        merchant:      Address,
        amount:        i128,
        pi_a:          soroban_sdk::Bytes,
        pi_b:          soroban_sdk::Bytes,
        pi_c:          soroban_sdk::Bytes,
        public_inputs: soroban_sdk::Vec<soroban_sdk::BytesN<32>>,
    ) -> Result<(), FLuppyError> {
        payment::execute_payment(
            env, sender, merchant, amount,
            pi_a, pi_b, pi_c, public_inputs,
        )
    }
}