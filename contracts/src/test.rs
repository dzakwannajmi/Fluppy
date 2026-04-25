#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN, Env, Vec};

use soroban_sdk::crypto::bn254::{Bn254G1Affine, Bn254G2Affine};

#[contract]
pub struct MockVerifier;

#[contractimpl]
impl MockVerifier {
    pub fn verify_proof(_env: Env, _g1: Vec<Bn254G1Affine>, _g2: Vec<Bn254G2Affine>) -> bool {
        true
    }
}

// #[contractimpl]
// impl MockVerifier {
//     pub fn verify_proof(_env: Env, _proof: Bytes, _public_inputs: Vec<Bytes>) -> bool {
//         true
//     }
// }

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    // Hanya fungsi yang dipanggil di pay_with_zk
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
        // No-op → cukup biar tidak panic.
        // Karena env.mock_all_auths(), kita tidak perlu handle balance/auth.
    }

    // Kalau kontrak kamu memanggil fungsi token lain (balance, approve, dll),
    // tambahkan di sini juga.
}

#[test]
fn test_pay_with_zk_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let dev_wallet = Address::generate(&env);

    // ✅ USDC sekarang pakai MockToken (bukan Address::generate lagi)
    let usdc_token = env.register(MockToken, ());

    let contract_id = env.register(FluppyZkContract, ());
    let client = FluppyZkContractClient::new(&env, &contract_id);

    // Register mock verifier
    let verifier_id = env.register(MockVerifier, ());

    // Initialize contract
    client.initialize(&admin, &usdc_token, &dev_wallet);

    // Set verifier
    client.set_ultrahonk_verifier(&admin, &verifier_id);

    let mut public_inputs: Vec<Bytes> = Vec::new(&env);
    public_inputs.push_back(Bytes::from_array(&env, &[1u8; 32]));

    let g1_points: Vec<Bn254G1Affine> = soroban_sdk::vec![
        &env,
        Bn254G1Affine::from_bytes(BytesN::from_array(&env, &[0u8; 64]))
    ];

    let g2_points: Vec<Bn254G2Affine> = soroban_sdk::vec![
        &env,
        Bn254G2Affine::from_bytes(BytesN::from_array(&env, &[0u8; 128]))
    ];

    let zk_proof = ZKProof {
        g1_points,
        g2_points,
    };

    // Jalankan payment → sekarang tidak akan panic lagi
    client.pay_with_zk(&payer, &merchant, &100_000_000i128, &zk_proof);
}

#[test]
fn test_initialize_and_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let dev_wallet = Address::generate(&env);
    let usdc_token = Address::generate(&env);

    let contract_id = env.register(FluppyZkContract, ());
    let client = FluppyZkContractClient::new(&env, &contract_id);

    client.initialize(&admin, &usdc_token, &dev_wallet);

    assert!(!client.is_paused());

    client.set_pause(&admin, &true);
    assert!(client.is_paused());
}
