#![no_std]
mod errors;
mod payment;
mod types;
mod verify;

use errors::FluppyError;
use soroban_sdk::{contract, contractevent, contractimpl, token, Address, Env};
pub use types::*;

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayZkEvent {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
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
    /// 1. Main Function: Melakukan pembayaran dengan verifikasi ZKP
    pub fn pay_with_zk(
        env: Env,
        config: PaymentConfig,
        from: Address,
        to: Address,
        amount: i128,
        zk_proof: ZKProof,
    ) -> Result<(), FluppyError> {
        // Cek apakah kontrak sedang di-pause
        check_if_paused(&env)?;

        // Verifikasi keanggotaan via Merkle Proof (SHA256)
        if !verify::verify_membership(&env, zk_proof.root, zk_proof.proof, zk_proof.leaf) {
            return Err(FluppyError::UnauthorizedMember);
        }

        // Kalkulasi pembagian dana (95/5)
        let (owner_amt, dev_amt) = payment::calculate_split(amount, config.fee_percentage);

        // Eksekusi transfer token
        from.require_auth();
        let client = token::TokenClient::new(&env, &config.usdc_token);
        client.transfer(&from, &to, &owner_amt);
        client.transfer(&from, &config.dev_ops, &dev_amt);

        // Publikasi Event
        PayZkEvent {
            from: from.clone(),
            to,
            amount,
        }
        .publish(&env);

        Ok(())
    }

    /// 2. Admin: Inisialisasi kontrak (Hanya 1x panggil)
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::IsPaused, &false);
    }

    /// 3. Admin: Mengaktifkan/Mematikan fungsi pembayaran (Circuit Breaker)
    pub fn set_pause(env: Env, admin: Address, paused: bool) -> Result<(), FluppyError> {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            return Err(FluppyError::NotAdmin);
        }

        env.storage().instance().set(&DataKey::IsPaused, &paused);

        // GARIS KUNING HILANG! Pakai cara modern:
        PauseStatusEvent { is_paused: paused }.publish(&env);

        Ok(())
    }

    /// 4. Getter: Cek apakah kontrak sedang pause
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsPaused)
            .unwrap_or(false)
    }
}

/// Helper Internal: Mengecek status pause (Private)
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
