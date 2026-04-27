use soroban_sdk::{symbol_short, token::Client as TokenClient, Address, Bytes, BytesN, Env, Vec};

use crate::{DataKey, FLuppyError};

// ─── Constants ────────────────────────────────────────────────────────────────

/// Number of public signals for FluppyPayment(20).
/// Order: [nullifier, verifiedRoot, merkleRoot, recipientHash, minAmount, maxAmount]
const N_PUBLIC: u32 = 6;

/// 95% merchant share — numerator for checked arithmetic.
const MERCHANT_BPS: i128 = 95;
/// 5% treasury share — numerator for checked arithmetic.
const TREASURY_BPS: i128 = 5;
const BPS_DENOM: i128 = 100;

/// Nullifier TTL: extend to ~300 days (5-second ledgers).
/// Source: contracts-soroban.md — persistent TTL management.
/// A spent nullifier MUST NOT be allowed to archive — expiry = replay vector.
const NULLIFIER_TTL_MIN: u32 = 518_400; // ~30 days
const NULLIFIER_TTL_EXTEND: u32 = 5_184_000; // ~300 days

// ─── Index aliases (documentation only — enforced by position) ────────────────
const IDX_NULLIFIER: u32 = 0;
const IDX_VERIFIED_ROOT: u32 = 1;
const IDX_MERKLE_ROOT: u32 = 2;
const IDX_RECIPIENT_HASH: u32 = 3;
const IDX_MIN_AMOUNT: u32 = 4;
const IDX_MAX_AMOUNT: u32 = 5;

// ─── Mock verifier ────────────────────────────────────────────────────────────

/// REPLACE WITH REAL BN254 VERIFY (CAP-0074)
///
/// Signature is forward-compatible with the real Groth16 verifier in verify.rs.
/// When CAP-0074 is live on the target network, swap this body for:
///   `verify_groth16_proof(env, pi_a, pi_b, pi_c, public_inputs)`
///
/// Source: zk-proofs.md — verification gateway, policy-and-proof split.
#[allow(unused_variables)]
fn mock_verify(
    env: &Env,
    pi_a: &Bytes,
    pi_b: &Bytes,
    pi_c: &Bytes,
    public_inputs: &Vec<BytesN<32>>,
) -> bool {
    // REPLACE WITH REAL BN254 VERIFY (CAP-0074)
    true
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Reads a required value from instance storage.
/// Panics with a clear message if the contract was not initialized.
/// Source: contracts-soroban.md — fail fast on missing config.
fn load_instance<T: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(env: &Env, key: &DataKey) -> T {
    env.storage()
        .instance()
        .get(key)
        .unwrap_or_else(|| panic!("not initialized"))
}

/// Interprets a 32-byte big-endian BytesN<32> as an i128 amount (lower 16 bytes).
/// The circuit uses 64-bit range checks, so only bytes [16..32] carry meaningful data.
/// Upper bytes [0..16] must be zero for a valid circuit output.
///
/// Source: SOW — amounts are stroops (i128); circuit bounds are 64-bit.
fn bytes32_to_i128(b: &BytesN<32>) -> i128 {
    let raw = b.to_array();
    // Reject any value where the upper 16 bytes are non-zero.
    // Circuit LessEqThan(64) guarantees this for valid proofs; we enforce it
    // defensively here to prevent type confusion attacks.
    for byte in &raw[0..16] {
        if *byte != 0 {
            // Non-zero upper bytes → amount would exceed i128::MAX.
            // This cannot happen with a valid Circom proof but must be caught
            // defensively against malformed frontend inputs.
            panic!("amount overflow: upper bytes non-zero");
        }
    }
    let mut buf = [0u8; 16];
    buf.copy_from_slice(&raw[16..32]);
    i128::from_be_bytes(buf)
}

/// Computes `Poseidon(address_bytes)` to match the circuit's recipientHash signal.
///
/// NOTE: Until CAP-0075 (Poseidon2 host function) is available, we use SHA-256
/// as a structural placeholder. You MUST align this with the off-chain hash used
/// in `zkp.ts` when computing `recipientHash = Poseidon(recipientAddr)`.
///
/// REPLACE WITH env.crypto().poseidon2(...) WHEN CAP-0075 IS LIVE.
///
/// Source: zk-proofs.md — recipient integrity check.
fn hash_address(env: &Env, addr: &Address) -> BytesN<32> {
    use soroban_sdk::xdr::ToXdr;
    let raw: soroban_sdk::Bytes = addr.to_xdr(env);

    let mut hash_bytes = env.crypto().sha256(&raw).to_array();

    hash_bytes[0] = 0;

    BytesN::from_array(env, &hash_bytes)
}
// ─── Core function ────────────────────────────────────────────────────────────

/// Executes a ZK-verified USDC payment with atomic 95/5 fee split.
///
/// STRICT EXECUTION ORDER (must not be reordered — security invariant):
///   1. Validate public_inputs length
///   2. Extract all signal fields
///   3. Consistency checks (recipient hash, amount bounds)
///   4. Nullifier uniqueness check  ← fail before any crypto cost
///   5. ZK proof verification      ← mock now, real BN254 later
///   6. sender.require_auth()      ← authorize USDC debit
///   7. USDC atomic split (95% merchant, 5% treasury)
///   8. Mark nullifier spent       ← AFTER transfer succeeds
///   9. Emit audit event
///
/// Source: security.md §6 — atomic check-and-use, no state-change gaps.
/// Source: security.md §4 — all arithmetic is checked.
/// Source: contracts-soroban.md — SAC TokenClient, events, persistent TTL.
/// Source: zk-proofs.md — verification gateway, anti-replay binding.
pub fn execute_payment(
    env: Env,
    sender: Address,
    merchant: Address,
    amount: i128,
    pi_a: Bytes,
    pi_b: Bytes,
    pi_c: Bytes,
    public_inputs: Vec<BytesN<32>>,
) -> Result<(), FLuppyError> {
    // ── 1. Validate public_inputs length ──────────────────────────────────
    // Reject before touching any storage — cheapest possible failure.
    // Source: security.md §7 — validate all external data first.
    if public_inputs.len() != N_PUBLIC {
        return Err(FLuppyError::InvalidInputCount);
    }

    // ── 2. Extract public signals (order is a security invariant) ─────────
    // IDX_* constants document which Circom signal maps to which slot.
    // Mismatch here would cause a valid proof to authorize the wrong payment.
    let nullifier: BytesN<32> = public_inputs.get(IDX_NULLIFIER).unwrap();
    let verified_root: BytesN<32> = public_inputs.get(IDX_VERIFIED_ROOT).unwrap();
    let merkle_root: BytesN<32> = public_inputs.get(IDX_MERKLE_ROOT).unwrap();
    let recipient_hash: BytesN<32> = public_inputs.get(IDX_RECIPIENT_HASH).unwrap();
    let min_amount_b: BytesN<32> = public_inputs.get(IDX_MIN_AMOUNT).unwrap();
    let max_amount_b: BytesN<32> = public_inputs.get(IDX_MAX_AMOUNT).unwrap();

    // ── 3a. Recipient integrity — Hash(merchant) MUST equal recipientHash ─
    // Prevents an attacker from proving a valid payment to recipient A but
    // routing funds to merchant B by swapping the `merchant` argument.
    // Source: security.md §7 — untrusted external arguments.
    let expected_hash = hash_address(&env, &merchant);
    if expected_hash != recipient_hash {
        return Err(FLuppyError::RecipientMismatch);
    }

    // ── 3b. Validate verifiedRoot == merkleRoot ───────────────────────────
    // The circuit already constrains this, but we re-check on-chain to
    // catch any mismatch introduced by a malformed proof or buggy frontend.
    if verified_root != merkle_root {
        return Err(FLuppyError::RecipientMismatch);
    }

    // ── 3c. Amount bounds ─────────────────────────────────────────────────
    // Convert circuit bounds (BytesN<32>) back to i128 for comparison.
    // Source: security.md §4 — validate inputs, no unchecked arithmetic.
    if amount <= 0 {
        return Err(FLuppyError::InvalidAmount);
    }
    let min_amount = bytes32_to_i128(&min_amount_b);
    let max_amount = bytes32_to_i128(&max_amount_b);
    if amount < min_amount || amount > max_amount {
        return Err(FLuppyError::AmountOutOfBounds);
    }

    // ── 4. Nullifier uniqueness check ─────────────────────────────────────
    // Checked BEFORE proof verification — reject cheaply if already spent.
    // Source: zk-proofs.md — anti-replay binding.
    // Source: security.md §6 — fail fast before expensive operations.
    let nullifier_key = DataKey::Nullifier(nullifier.clone());
    if env.storage().persistent().has(&nullifier_key) {
        return Err(FLuppyError::NullifierSpent);
    }

    // ── 5. ZK proof verification ──────────────────────────────────────────
    // REPLACE mock_verify WITH REAL BN254 VERIFY (CAP-0074) WHEN AVAILABLE.
    // Source: zk-proofs.md — verification gateway.
    if !mock_verify(&env, &pi_a, &pi_b, &pi_c, &public_inputs) {
        return Err(FLuppyError::InvalidProof);
    }

    // ── 6. Authorize sender ───────────────────────────────────────────────
    // Called AFTER proof verification so an invalid proof fails before the
    // wallet signature prompt is ever reached (better UX + saves auth cost).
    // Source: contracts-soroban.md — explicit authorization.
    // Source: security.md §1 — missing auth check pattern.
    sender.require_auth();

    // ── 7. Atomic USDC split (95% merchant, 5% treasury) ──────────────────
    // Loaded from immutable instance storage — not from caller arguments.
    // Source: SOW — 95/5 atomic split.
    // Source: security.md §3 — SAC address from trusted storage, not args.
    let usdc_token: Address = load_instance(&env, &DataKey::UsdcToken);
    let treasury: Address = load_instance(&env, &DataKey::Treasury);

    let fee = amount
        .checked_mul(TREASURY_BPS)
        .and_then(|v| v.checked_div(BPS_DENOM))
        .ok_or(FLuppyError::ArithmeticOverflow)?;

    let merchant_amount = amount
        .checked_sub(fee)
        .ok_or(FLuppyError::ArithmeticOverflow)?;

    let token = TokenClient::new(&env, &usdc_token);

    // Both transfers happen in the same ledger entry — atomic by design.
    // If either panics, the entire transaction rolls back.
    token.transfer(&sender, &merchant, &merchant_amount);
    token.transfer(&sender, &treasury, &fee);

    // ── 8. Mark nullifier spent ───────────────────────────────────────────
    // Marked AFTER transfers succeed. If a transfer panics (e.g. insufficient
    // balance), the nullifier stays fresh so the user can retry after funding.
    // TTL extended aggressively — archival of a spent nullifier = replay vuln.
    // Source: zk-proofs.md — persistent anti-replay guard.
    // Source: contracts-soroban.md — persistent TTL management.
    env.storage().persistent().set(&nullifier_key, &true);
    env.storage()
        .persistent()
        .extend_ttl(&nullifier_key, NULLIFIER_TTL_MIN, NULLIFIER_TTL_EXTEND);

    // ── 9. Emit audit event ───────────────────────────────────────────────
    // Source: contracts-soroban.md — events for auditable state changes.
    // Source: README.md — Fluppy emits total_amount, merchant_receive, fee, ts.
    env.events().publish(
        (symbol_short!("zkpay"),),
        (
            nullifier,
            sender,
            merchant,
            amount,
            merchant_amount,
            fee,
            merkle_root,
        ),
    );

    Ok(())
}
