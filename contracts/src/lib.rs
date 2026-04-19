#![no_std]
mod errors;
mod payment;
mod types;
mod verify;

#[cfg(test)]
mod test;

// Added 'Symbol' to imports to resolve the resolution error
use errors::FluppyError;
use soroban_sdk::{contract, contractevent, contractimpl, token, Address, Env};
pub use types::*;

/// Enhanced Event for transparency.
/// Including fee_amount and timestamp allows external indexers to track
/// protocol revenue and transaction timing without complex ledger re-calculations.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayZkEvent {
    pub from: Address,
    pub merchant: Address,
    pub total_amount: i128,
    pub merchant_receive: i128,
    pub protocol_fee: i128,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseStatusEvent {
    pub is_paused: bool,
}

#[contract]
pub struct FluppyZkContract;

#[contractimpl]
impl FluppyZkContract {
    /// Executes a private, ZK-verified payment with automatic 95/5 fee splitting.
    pub fn pay_with_zk(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        zk_proof: ZKProof,
    ) -> Result<(), FluppyError> {
        check_if_paused(&env)?;

        // Fetch protocol configuration
        let config: PaymentConfig = env.storage().instance().get(&DataKey::Config).unwrap();

        // 1. ZKP Membership Verification
        // Validates that the user is part of the authorized Merkle Root.
        if !verify::verify_membership(&env, zk_proof.root, zk_proof.proof, zk_proof.leaf) {
            return Err(FluppyError::UnauthorizedMember);
        }

        // 2. Financial Logic Consolidation
        // We calculate the split once to save gas and ensure consistency.
        // merchant_amt = 95%, treasury_amt = 5%
        let (merchant_amt, treasury_amt) = payment::calculate_split(amount, config.fee_percentage);
        let current_timestamp = env.ledger().timestamp();

        // 3. Secure Asset Transfer
        // Funds move directly from the payer to destinations via the Stellar Asset Contract.
        from.require_auth();
        let client = token::TokenClient::new(&env, &config.usdc_token);

        // Atomic settlement: Transfer to merchant and treasury in a single transaction.
        client.transfer(&from, &to, &merchant_amt);
        client.transfer(&from, &config.dev_ops, &treasury_amt);

        // 4. Audit-Friendly Event Emission
        // We emit a single, comprehensive event. This is more gas-efficient than multiple events
        // and provides a complete data point for indexers (Stellar Expert, etc.)
        PayZkEvent {
            from,
            merchant: to,
            total_amount: amount,
            merchant_receive: merchant_amt,
            protocol_fee: treasury_amt,
            timestamp: current_timestamp,
        }
        .publish(&env);

        Ok(())
    }

    pub fn initialize(env: Env, admin: Address, usdc: Address, dev_wallet: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        let config = PaymentConfig {
            usdc_token: usdc,
            dev_ops: dev_wallet,
            fee_percentage: 500, // 500 Basis Points = 5%
        };

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::IsPaused, &false);
    }

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

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsPaused)
            .unwrap_or(false)
    }
}

fn check_if_paused(env: &Env) -> Result<(), FluppyError> {
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
