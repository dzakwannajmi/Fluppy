#![no_std]
mod types;
mod errors;
mod payment;
mod verify;

use soroban_sdk::{contract, contractimpl, contractevent, Address, Env, token};
use types::*;
use errors::FluppyError;

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayZkEvent {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

#[contract]
pub struct FluppyZkContract;

#[contractimpl]
impl FluppyZkContract {
    
    pub fn pay_with_zk(
        env: Env,
        config: PaymentConfig,
        from: Address,
        to: Address,
        amount: i128,
        zk_proof: ZKProof
    ) -> Result<(), FluppyError> {
        
        // 1. Validasi ZK Proof (Merkle Membership)
        if !verify::verify_membership(&env, zk_proof.root, zk_proof.proof, zk_proof.leaf) {
            return Err(FluppyError::UnauthorizedMember);
        }

        // 2. Kalkulasi Split
        let (owner_amt, dev_amt) = payment::calculate_split(amount, config.fee_percentage);

        // 3. Eksekusi Transfer
        from.require_auth();

        let client = token::TokenClient::new(&env, &config.usdc_token);
        client.transfer(&from, &to, &owner_amt);
        client.transfer(&from, &config.dev_ops, &dev_amt);

        // [MODERN FIX] Cara panggil event yang bener di v25:
        // Panggil langsung dari Struct-nya!
        PayZkEvent {
            from: from.clone(),
            to,
            amount,
        }.publish(&env); // <--- Jauh lebih bersih & modern
        
        Ok(())
    }
}