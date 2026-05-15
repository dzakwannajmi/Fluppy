#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Bytes, BytesN, Env, Vec};

// ─────────────────────────────────────────────────────────────────────────────
// Test fixture
// ─────────────────────────────────────────────────────────────────────────────

struct F {
    env: Env,
    client: FluppyContractClient<'static>,
    admin: Address,
    treasury: Address,
    usdc: token::Client<'static>,
    usdc_sa: token::StellarAssetClient<'static>,
    root: BytesN<32>,
}

fn setup() -> F {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);

    let usdc_id = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = token::Client::new(&env, &usdc_id);
    let usdc_sa = token::StellarAssetClient::new(&env, &usdc_id);

    let root = BytesN::from_array(&env, &[0x01; 32]);

    // __constructor fires here — pass args as tuple matching parameter order:
    // (admin, usdc_token, treasury, merkle_root)
    let contract_id = env.register(FluppyContract, (&admin, &usdc_id, &treasury, &root));
    let client = FluppyContractClient::new(&env, &contract_id);

    F {
        env,
        client,
        admin,
        treasury,
        usdc,
        usdc_sa,
        root,
    }
}

/// Builds a valid proof payload for tests.
///
/// KEY FIX: public_inputs[3] = compute_recipient_hash(merchant)
/// Payment.rs recomputes this hash and rejects if it doesn't match.
/// Passing zeros caused Error(Contract, #6) = RecipientMismatch.
fn make_proof(
    env: &Env,
    nullifier: &BytesN<32>,
    root: &BytesN<32>,
    merchant: &Address, // ← REQUIRED: used to compute correct recipientHash
) -> (Bytes, Bytes, Bytes, Vec<BytesN<32>>) {
    let zero = BytesN::from_array(env, &[0u8; 32]);

    // Compute the REAL recipient hash — same function as payment.rs uses.
    // This is what the Circom circuit would output as public_inputs[3].
    let recipient_hash = payment::compute_recipient_hash(env, merchant);

    let chain_id = payment::compute_chain_id_pub(env);

    let mut inputs: Vec<BytesN<32>> = Vec::new(env);
    inputs.push_back(nullifier.clone()); // [0] nullifier      — unique spend tag
    inputs.push_back(root.clone()); // [1] verifiedRoot   — circuit re-derived root
    inputs.push_back(root.clone()); // [2] merkleRoot     — must match stored root
    inputs.push_back(recipient_hash); // [3] recipientHash  — SHA256(XDR(merchant))[MSB=0]
    inputs.push_back(zero.clone()); // [4] minAmount      — circuit lower bound
    inputs.push_back(zero.clone()); // [5] maxAmount      — circuit upper bound
    inputs.push_back(chain_id); // [6] chainId        — circuit chain identifier

    // Proof points can be zeros in test mode — pairing check is mocked
    let pi_a = Bytes::from_slice(env, &[0u8; 64]);
    let pi_b = Bytes::from_slice(env, &[0u8; 128]);
    let pi_c = Bytes::from_slice(env, &[0u8; 64]);

    (pi_a, pi_b, pi_c, inputs)
}



const PAYMENT: i128 = 100_000_000; // 10 USDC

// ─────────────────────────────────────────────────────────────────────────────
// §1  Initialization
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_constructor_sets_correct_state() {
    let f = setup();
    assert_eq!(f.client.is_paused(), false, "Must not be paused after init");
    assert_eq!(
        f.client.get_merkle_root(),
        Some(f.root.clone()),
        "Root must match"
    );
}

/// Note: __constructor is invoked by env.register() and cannot be called
/// again via the client (by design — this is the Soroban security guarantee).
/// Each env.register() creates a new contract address with fresh storage,
/// so double-registration creates two DIFFERENT contracts, not a re-init.
/// The guard `if env.storage().instance().has(&DataKey::Admin) { panic!() }`
/// is verified here by confirming Admin IS set after the first registration.
#[test]
fn test_constructor_guard_sets_admin_immutably() {
    let f = setup();
    // Admin was set — the guard `has(&DataKey::Admin)` would fire on re-init
    // We verify state is consistent (admin is implicitly verified via ACL tests)
    assert_eq!(f.client.is_paused(), false);
    assert!(f.client.get_merkle_root().is_some());

    // Non-admin cannot change critical state — proves admin is locked
    let imposter = Address::generate(&f.env);
    assert!(
        f.client.try_set_pause(&imposter, &true).is_err(),
        "Admin is locked — imposter must be rejected"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  Payment execution and 95/5 split
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_successful_payment_atomic_split() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    let nullifier = BytesN::from_array(&f.env, &[0x01; 32]);
    // Pass merchant so make_proof can compute the correct recipientHash
    let (pi_a, pi_b, pi_c, inputs) = make_proof(&f.env, &nullifier, &f.root, &merchant);

    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);

    assert_eq!(
        f.usdc.balance(&merchant),
        95_000_000,
        "Merchant must receive 95%"
    );
    assert_eq!(
        f.usdc.balance(&f.treasury),
        5_000_000,
        "Treasury must receive 5%"
    );
    assert_eq!(f.usdc.balance(&payer), 0, "Payer must be fully debited");
}

#[test]
fn test_payment_marks_nullifier_spent() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    let nullifier = BytesN::from_array(&f.env, &[0x02; 32]);
    let (pi_a, pi_b, pi_c, inputs) = make_proof(&f.env, &nullifier, &f.root, &merchant);

    assert!(
        !f.client.is_nullifier_spent(&nullifier),
        "Must be unspent before payment"
    );
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert!(
        f.client.is_nullifier_spent(&nullifier),
        "Must be spent after payment"
    );
}

#[test]
fn test_small_payment_split_precision() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    let amount = 1_000_000_i128; // 0.1 USDC
    f.usdc_sa.mint(&payer, &amount);

    let nullifier = BytesN::from_array(&f.env, &[0x03; 32]);
    let (pi_a, pi_b, pi_c, inputs) = make_proof(&f.env, &nullifier, &f.root, &merchant);

    f.client
        .execute_payment(&payer, &merchant, &amount, &pi_a, &pi_b, &pi_c, &inputs);

    assert_eq!(f.usdc.balance(&merchant), 950_000);
    assert_eq!(f.usdc.balance(&f.treasury), 50_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  Nullifier replay protection
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_nullifier_replay_rejected() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &(PAYMENT * 2));

    let nullifier = BytesN::from_array(&f.env, &[0x04; 32]);

    // First payment — must succeed
    let (a1, b1, c1, i1) = make_proof(&f.env, &nullifier, &f.root, &merchant);
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a1, &b1, &c1, &i1);

    // Second payment with SAME nullifier — must fail
    let (a2, b2, c2, i2) = make_proof(&f.env, &nullifier, &f.root, &merchant);
    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &a2, &b2, &c2, &i2);
    assert!(result.is_err(), "Replayed nullifier must be rejected");
}

#[test]
fn test_two_distinct_nullifiers_both_succeed() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &(PAYMENT * 2));

    let n1 = BytesN::from_array(&f.env, &[0x05; 32]);
    let n2 = BytesN::from_array(&f.env, &[0x06; 32]);

    let (a1, b1, c1, i1) = make_proof(&f.env, &n1, &f.root, &merchant);
    let (a2, b2, c2, i2) = make_proof(&f.env, &n2, &f.root, &merchant);

    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a1, &b1, &c1, &i1);
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a2, &b2, &c2, &i2);

    assert_eq!(f.usdc.balance(&merchant), 190_000_000);
    assert_eq!(f.usdc.balance(&payer), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  Merkle root enforcement
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_wrong_merkle_root_rejected() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);

    let wrong_root = BytesN::from_array(&f.env, &[0x03; 32]);
    let nullifier = BytesN::from_array(&f.env, &[0x07; 32]);
    // Error occurs at step 5 (root mismatch) — before step 7 (recipient check)
    // so merchant hash doesn't matter here, but we pass it correctly anyway
    let (pi_a, pi_b, pi_c, inputs) = make_proof(&f.env, &nullifier, &wrong_root, &merchant);

    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert!(result.is_err(), "Wrong Merkle root must be rejected");
}

#[test]
fn test_wrong_input_count_rejected() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);

    // Only 3 inputs — fails at step 2 (count guard), before any hash check
    let mut short: Vec<BytesN<32>> = Vec::new(&f.env);
    for _ in 0..3 {
        short.push_back(BytesN::from_array(&f.env, &[0u8; 32]));
    }
    let pi_a = Bytes::from_slice(&f.env, &[0u8; 64]);
    let pi_b = Bytes::from_slice(&f.env, &[0u8; 128]);
    let pi_c = Bytes::from_slice(&f.env, &[0u8; 64]);

    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &short);
    assert!(result.is_err(), "Wrong input count must be rejected");
}

// ─────────────────────────────────────────────────────────────────────────────
// §5  Circuit-breaker
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_pause_blocks_payments() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);

    f.client.set_pause(&f.admin, &true);
    assert!(f.client.is_paused(), "Must be paused");

    let nullifier = BytesN::from_array(&f.env, &[0x08; 32]);
    // Error at step 1 (paused) — before any other check
    let (pi_a, pi_b, pi_c, inputs) = make_proof(&f.env, &nullifier, &f.root, &merchant);

    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert!(result.is_err(), "Paused contract must reject all payments");
}

#[test]
fn test_unpause_restores_payments() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    f.client.set_pause(&f.admin, &true);
    f.client.set_pause(&f.admin, &false);
    assert!(!f.client.is_paused(), "Must be unpaused");

    let nullifier = BytesN::from_array(&f.env, &[0x09; 32]);
    let (pi_a, pi_b, pi_c, inputs) = make_proof(&f.env, &nullifier, &f.root, &merchant);

    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert_eq!(f.usdc.balance(&merchant), 95_000_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// §6  Access control
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_non_admin_cannot_pause() {
    let f = setup();
    let imposter = Address::generate(&f.env);
    assert!(f.client.try_set_pause(&imposter, &true).is_err());
}

#[test]
fn test_non_admin_cannot_update_root() {
    let f = setup();
    let imposter = Address::generate(&f.env);
    let new_root = BytesN::from_array(&f.env, &[0xCD; 32]);
    assert!(f.client.try_set_merkle_root(&imposter, &new_root).is_err());
}

#[test]
fn test_non_admin_cannot_set_fee() {
    let f = setup();
    let imposter = Address::generate(&f.env);
    assert!(f.client.try_set_fee(&imposter, &100_i128).is_err());
}

// ─────────────────────────────────────────────────────────────────────────────
// §7  Admin management
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_admin_can_update_merkle_root() {
    let f = setup();
    let new_root = BytesN::from_array(&f.env, &[0xCD; 32]);
    f.client.set_merkle_root(&f.admin, &new_root);
    assert_eq!(f.client.get_merkle_root(), Some(new_root));
}

#[test]
fn test_fee_above_cap_rejected() {
    let f = setup();
    assert!(f.client.try_set_fee(&f.admin, &1001_i128).is_err());
}

#[test]
fn test_custom_fee_applied_correctly() {
    let f = setup();
    f.client.set_fee(&f.admin, &1000_i128); // 10%

    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    let nullifier = BytesN::from_array(&f.env, &[0x0A; 32]);
    let (pi_a, pi_b, pi_c, inputs) = make_proof(&f.env, &nullifier, &f.root, &merchant);

    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);

    assert_eq!(
        f.usdc.balance(&merchant),
        90_000_000,
        "Merchant receives 90% at 10% fee"
    );
    assert_eq!(
        f.usdc.balance(&f.treasury),
        10_000_000,
        "Treasury receives 10%"
    );
}

#[test]
fn test_root_update_blocks_old_root_proofs() {
    let f = setup();
    let new_root = BytesN::from_array(&f.env, &[0x02; 32]);
    f.client.set_merkle_root(&f.admin, &new_root);

    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    // Proof with OLD root — must now be rejected
    let n1 = BytesN::from_array(&f.env, &[0x0B; 32]);
    let (a1, b1, c1, i1) = make_proof(&f.env, &n1, &f.root, &merchant);
    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &a1, &b1, &c1, &i1);
    assert!(
        result.is_err(),
        "Old root proof must be rejected after root update"
    );

    // Proof with NEW root — must succeed
    let n2 = BytesN::from_array(&f.env, &[0x0C; 32]);
    let (a2, b2, c2, i2) = make_proof(&f.env, &n2, &new_root, &merchant);
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a2, &b2, &c2, &i2);
    assert_eq!(f.usdc.balance(&merchant), 95_000_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// §8  Pure arithmetic (no env — instantaneous)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_split_standard_5pct() {
    let (m, t) = payment::calculate_split(100_000_000, 500).unwrap();
    assert_eq!(m, 95_000_000);
    assert_eq!(t, 5_000_000);
}

#[test]
fn test_split_10pct() {
    let (m, t) = payment::calculate_split(100_000_000, 1000).unwrap();
    assert_eq!(m, 90_000_000);
    assert_eq!(t, 10_000_000);
}

#[test]
fn test_split_zero_amount() {
    let (m, t) = payment::calculate_split(0, 500).unwrap();
    assert_eq!(m, 0);
    assert_eq!(t, 0);
}

#[test]
fn test_split_no_overflow_on_large_amount() {
    // Maximum safe amount: must satisfy amount * max_fee_bps <= i128::MAX
    // Safe upper bound: i128::MAX / 10_000 (the divisor used in calculate_split)
    let safe_large = i128::MAX / 10_000;
    let result = payment::calculate_split(safe_large, 500);
    assert!(
        result.is_ok(),
        "Large amounts within safe bounds must not overflow"
    );
    let (m, t) = result.unwrap();
    assert!(m > 0);
    assert!(t > 0);
    assert_eq!(m + t, safe_large);
}
