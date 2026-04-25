#![no_std]
mod errors;
mod payment;
mod types;
mod verify; // ⬅️ Modul Groth16 BN254 baru kita

#[cfg(test)]
mod test;

use errors::FluppyError;
use soroban_sdk::{contract, contractevent, contractimpl, token, Address, BytesN, Env};
use types::*;
use verify::{verify_groth16_proof};

// ================== PROTOCOL 25 ZK VERIFICATION ==================
// verify_groth16_proof(
//     &env, pi_a, pi_b, pi_c,
//     nullifier.clone(), merkle_root.clone(), merkle_root,
//     recipient_hash, min_amount, max_amount
// ).map_err(|_| FluppyError::UnauthorizedMember)?;

// ====================== EVENTS ======================
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

// ====================== CONTRACT ======================
#[contract]
pub struct FluppyZkContract;

#[contractimpl]
impl FluppyZkContract {
    /// Initialize contract (One-Time Initialization + Panic Guard)
    pub fn initialize(
        env: Env, 
        admin: Address, 
        usdc: Address, 
        dev_wallet: Address,
        merkle_root: BytesN<32> // ⬅️ Tambahan: Root awal untuk verifikasi identitas
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized"); // Immutable setelah deploy
        }

        let config = PaymentConfig {
            usdc_token: usdc,
            dev_ops: dev_wallet,
            fee_percentage: 500, // 5% = 500 basis points
        };

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::MerkleRoot, &merkle_root);
        env.storage().instance().set(&DataKey::IsPaused, &false);
    }

/// Executes a private, ZK-verified payment with automatic 95/5 fee splitting
    pub fn pay_with_zk(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        pi_a: BytesN<64>,
        pi_b: BytesN<128>,
        pi_c: BytesN<64>,
        nullifier: BytesN<32>,
        merkle_root: BytesN<32>,
        recipient_hash: BytesN<32>,
        min_amount: BytesN<32>,
        max_amount: BytesN<32>,
    ) -> Result<(), FluppyError> {
        check_if_paused(&env)?;

        let config: PaymentConfig = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .unwrap_or_else(|| panic!("Contract not initialized"));

        // ================== SECURITY: ROOT & NULLIFIER GUARD ==================
        let stored_root: BytesN<32> = env.storage().instance().get(&DataKey::MerkleRoot).unwrap();
        if merkle_root != stored_root {
            panic!("Invalid Merkle Root");
        }

        if env.storage().persistent().has(&DataKey::Nullifier(nullifier.clone())) {
            panic!("Nullifier already spent!"); 
        }

        // ================== PROTOCOL 25 ZK VERIFICATION ==================
        // Nah, pemanggilan verify_groth16_proof harus ada di SINI (di dalam pay_with_zk)
        verify_groth16_proof(
            &env, 
            pi_a, 
            pi_b, 
            pi_c,
            nullifier.clone(), 
            merkle_root.clone(), 
            merkle_root, // verified_root disamakan dengan merkle_root
            recipient_hash, 
            min_amount, 
            max_amount
        ).map_err(|_| FluppyError::UnauthorizedMember)?;

        // Tandai Nullifier sebagai terpakai
        env.storage().persistent().set(&DataKey::Nullifier(nullifier.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::Nullifier(nullifier),
            518400,
            5184000,
        );

        // ================== FINANCIAL LOGIC (95/5 SPLIT) ==================
        let (merchant_amt, treasury_amt) = payment::calculate_split(amount, config.fee_percentage);
        let current_timestamp = env.ledger().timestamp();

        from.require_auth();
        let client = token::TokenClient::new(&env, &config.usdc_token);

        client.transfer(&from, &to, &merchant_amt);
        client.transfer(&from, &config.dev_ops, &treasury_amt);

        // ================== EVENT EMISSION ==================
        PayZkEvent {
            from: from.clone(),
            merchant: to.clone(),
            total_amount: amount,
            merchant_receive: merchant_amt,
            protocol_fee: treasury_amt,
            timestamp: current_timestamp,
        }
        .publish(&env);

        Ok(())
    }   

    // ================== ADMIN FUNCTIONS ==================
    // Fungsi set_ultrahonk_verifier DIHAPUS karena kita menggunakan native function

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
        env.storage().instance().get(&DataKey::IsPaused).unwrap_or(false)
    }
}

// ====================== HELPER ======================
fn check_if_paused(env: &Env) -> Result<(), FluppyError> {
    if env.storage().instance().get(&DataKey::IsPaused).unwrap_or(false) {
        return Err(FluppyError::ContractPaused);
    }
    Ok(())
}