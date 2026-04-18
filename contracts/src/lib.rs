#![no_std]
mod errors;
mod payment;
mod types;
mod verify;

use errors::FluppyError;
use soroban_sdk::{contract, contractevent, contractimpl, token, Address, Env};
pub use types::*;

/// Event emitted when a successful ZK-verified payment occurs.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayZkEvent {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

/// Event emitted when the protocol's circuit breaker (pause) status changes.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseStatusEvent {
    pub is_paused: bool,
}

#[contract]
pub struct FluppyZkContract;

#[contractimpl]
impl FluppyZkContract {
    /// Executes a private, ZK-verified payment with automatic fee splitting.
    ///
    /// # Architecture:
    /// 1. **Circuit Breaker:** Checks if the contract is paused for security.
    /// 2. **ZKP Verification:** Validates user membership via Merkle Tree Proof without exposing identity.
    /// 3. **Atomic Split:** Distributes funds (95% to Merchant, 5% to Protocol) in a single transaction.
    /// 4. **Non-Custodial:** Funds move directly from user to destination via the Token Client.
    pub fn pay_with_zk(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        zk_proof: ZKProof,
    ) -> Result<(), FluppyError> {
        // Ensure protocol is active
        check_if_paused(&env)?;

        // Fetch immutable protocol configuration from instance storage
        let config: PaymentConfig = env.storage().instance().get(&DataKey::Config).unwrap();

        // Zero-Knowledge Membership Verification (Merkle Root Validation)
        if !verify::verify_membership(&env, zk_proof.root, zk_proof.proof, zk_proof.leaf) {
            return Err(FluppyError::UnauthorizedMember);
        }

        // Calculate autonomous split (95/5 ratio)
        let (owner_amt, dev_amt) = payment::calculate_split(amount, config.fee_percentage);

        // Authorize the transaction and execute dual-transfer settlement
        from.require_auth();
        let client = token::TokenClient::new(&env, &config.usdc_token);

        // Atomic multi-destination transfer
        client.transfer(&from, &to, &owner_amt); // Merchant Settlement
        client.transfer(&from, &config.dev_ops, &dev_amt); // Protocol Treasury Fee

        // Emit audit-friendly event
        PayZkEvent { from, to, amount }.publish(&env);

        Ok(())
    }

    /// One-time initialization to anchor protocol parameters.
    /// Sets the admin, the settlement asset (USDC), and the treasury address.
    pub fn initialize(env: Env, admin: Address, usdc: Address, dev_wallet: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        let config = PaymentConfig {
            usdc_token: usdc,
            dev_ops: dev_wallet,
            fee_percentage: 500, // Fixed 5% protocol fee
        };

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::IsPaused, &false);
    }

    /// Administrative Circuit Breaker: Allows the admin to pause/unpause the contract
    /// in case of an emergency or protocol upgrade.
    pub fn set_pause(env: Env, admin: Address, paused: bool) -> Result<(), FluppyError> {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            return Err(FluppyError::NotAdmin);
        }

        env.storage().instance().set(&DataKey::IsPaused, &paused);
        PauseStatusEvent { is_paused: paused }.publish(&env);

        Ok(())
    }

    /// Read-only function to check the current operational status of the protocol.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsPaused)
            .unwrap_or(false)
    }
}

/// Internal security check for contract state.
fn check_if_paused(env: &Env) -> Result<(), FluppyError> {
    let is_paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::IsPaused)
        .unwrap_or(false);

    if is_paused {
        return Err(FluppyError::ContractPaused);
    }
    Ok(())
}
