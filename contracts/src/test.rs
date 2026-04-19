#![cfg(test)]
use super::*;
// Removed 'Events' to resolve unused_imports warning
use soroban_sdk::{testutils::Address as _, token, vec, Address, BytesN, Env};

/// Standard Test Setup for Fluppy Protocol
/// Updated with the latest Soroban SDK v25+ registration methods
fn setup_test(
    env: &Env,
) -> (
    FluppyZkContractClient<'static>,
    Address,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    env.mock_all_auths();

    // Updated: Using 'register' instead of deprecated 'register_contract'
    let contract_id = env.register(FluppyZkContract, ());
    let client = FluppyZkContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let dev_wallet = Address::generate(env);

    // Updated: Using 'register_stellar_asset_contract_v2' to align with modern SDK standards
    let usdc_id = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc_token = token::Client::new(env, &usdc_id);
    let usdc_admin = token::StellarAssetClient::new(env, &usdc_id);

    (client, admin, dev_wallet, usdc_token, usdc_admin)
}

#[test]
fn test_initialization() {
    let env = Env::default();
    let (client, admin, dev_wallet, usdc_token, _) = setup_test(&env);

    client.initialize(&admin, &usdc_token.address, &dev_wallet);

    assert_eq!(client.is_paused(), false);
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_re_initialization_fails() {
    let env = Env::default();
    let (client, admin, dev_wallet, usdc_token, _) = setup_test(&env);

    client.initialize(&admin, &usdc_token.address, &dev_wallet);
    // Security check: Secondary initialization must trigger a panic
    client.initialize(&admin, &usdc_token.address, &dev_wallet);
}

#[test]
fn test_successful_atomic_split_payment() {
    let env = Env::default();
    let (client, admin, dev_wallet, usdc_token, usdc_admin) = setup_test(&env);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let amount: i128 = 100_000_000; // 10 USDC representation

    client.initialize(&admin, &usdc_token.address, &dev_wallet);

    usdc_admin.mint(&payer, &amount);

    let root = BytesN::from_array(&env, &[0u8; 32]);
    let leaf = BytesN::from_array(&env, &[0u8; 32]);
    let proof = vec![&env];
    let zk_proof = ZKProof { root, proof, leaf };

    client.pay_with_zk(&payer, &merchant, &amount, &zk_proof);

    // Asserting the 95/5 atomic split logic as defined in Deliverable 2
    assert_eq!(usdc_token.balance(&merchant), 95_000_000);
    assert_eq!(usdc_token.balance(&dev_wallet), 5_000_000);
    assert_eq!(usdc_token.balance(&payer), 0);
}

#[test]
fn test_circuit_breaker_pause_logic() {
    let env = Env::default();
    let (client, admin, dev_wallet, usdc_token, _) = setup_test(&env);

    client.initialize(&admin, &usdc_token.address, &dev_wallet);

    client.set_pause(&admin, &true);
    assert_eq!(client.is_paused(), true);

    let payer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let zk_proof = ZKProof {
        root: BytesN::from_array(&env, &[0u8; 32]),
        proof: vec![&env],
        leaf: BytesN::from_array(&env, &[0u8; 32]),
    };

    let result = client.try_pay_with_zk(&payer, &merchant, &1000, &zk_proof);
    assert!(result.is_err());
}
