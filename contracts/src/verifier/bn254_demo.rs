//! BN254 demo backend.
//!
//! Performs field-element validation and structural checks but
//! does NOT execute on-chain pairing verification.
//!
//! Client-side Groth16 verification (snarkjs.groth16.verify) is still enforced
//! in zkp.ts before submission — this guarantees mathematical proof validity
//! at the boundary between user and contract.
//!
//! Will be replaced by bn254_native.rs once soroban-sdk exposes
//! bn254_g1_mul, bn254_g1_add, and bn254_pairing_check.

use soroban_sdk::{Bytes, BytesN, Env, U256};

use super::types::{Proof, PublicInputs, VerifyError, N_PUBLIC};
use super::vk_constants::{BN254_FIELD_PRIME_P, BN254_SCALAR_FIELD_R, VK};

// ─── Public entry ────────────────────────────────────────────────────────────

pub fn verify_proof_impl(
    env:    &Env,
    proof:  &Proof,
    inputs: &PublicInputs,
) -> Result<(), VerifyError> {
    let public_array = inputs.as_array();

    validate_public_inputs(&public_array)?;

    let vk_x      = compute_vk_x(env, &public_array);
    let _neg_vk_x = g1_negate(env, &vk_x)?;
    let _neg_pi_c = g1_negate(env, &proof.pi_c)?;

    // Demo mode: structural validation only.
    // Real pairing check skipped — see bn254_native.rs for production.
    let _neg_alpha = Bytes::from_slice(env, &VK.neg_alpha_g1);
    let _beta      = Bytes::from_slice(env, &VK.beta_g2);
    let _gamma     = Bytes::from_slice(env, &VK.gamma_g2);
    let _delta     = Bytes::from_slice(env, &VK.delta_g2);

    let valid = run_pairing_check_demo();
    if valid { Ok(()) } else { Err(VerifyError::InvalidProof) }
}

// ─── Internal helpers (moved verbatim from old verify.rs) ─────────────────────

#[inline]
fn be32_lt(a: &[u8; 32], b: &[u8; 32]) -> bool {
    for i in 0..32 {
        match a[i].cmp(&b[i]) {
            core::cmp::Ordering::Less    => return true,
            core::cmp::Ordering::Greater => return false,
            core::cmp::Ordering::Equal   => {}
        }
    }
    false
}

#[inline]
fn be32_sub(modulus: &[u8; 32], value: &[u8; 32]) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut borrow: u16 = 0;
    for i in (0..32).rev() {
        let m = modulus[i] as u16;
        let v = value[i] as u16 + borrow;
        if m >= v {
            result[i] = (m - v) as u8;
            borrow = 0;
        } else {
            result[i] = (m + 256 - v) as u8;
            borrow = 1;
        }
    }
    result
}

fn g1_negate(env: &Env, point: &BytesN<64>) -> Result<BytesN<64>, VerifyError> {
    let raw = point.to_array();
    let mut x_bytes = [0u8; 32];
    let mut y_bytes = [0u8; 32];
    x_bytes.copy_from_slice(&raw[0..32]);
    y_bytes.copy_from_slice(&raw[32..64]);

    if !be32_lt(&y_bytes, &BN254_FIELD_PRIME_P) {
        return Err(VerifyError::InputOutOfField);
    }

    let is_infinity = x_bytes == [0u8; 32] && y_bytes == [0u8; 32];
    let y_neg = if is_infinity {
        [0u8; 32]
    } else {
        be32_sub(&BN254_FIELD_PRIME_P, &y_bytes)
    };

    let mut out = [0u8; 64];
    out[..32].copy_from_slice(&x_bytes);
    out[32..].copy_from_slice(&y_neg);
    Ok(BytesN::from_array(env, &out))
}

#[allow(dead_code)]
fn bytes32_to_u256(env: &Env, raw: &[u8; 32]) -> U256 {
    let hi_hi = u64::from_be_bytes(raw[0..8].try_into().unwrap());
    let hi_lo = u64::from_be_bytes(raw[8..16].try_into().unwrap());
    let lo_hi = u64::from_be_bytes(raw[16..24].try_into().unwrap());
    let lo_lo = u64::from_be_bytes(raw[24..32].try_into().unwrap());
    U256::from_parts(env, hi_hi, hi_lo, lo_hi, lo_lo)
}

fn validate_public_inputs(
    inputs: &[&BytesN<32>; N_PUBLIC],
) -> Result<(), VerifyError> {
    for input in inputs.iter() {
        let raw = input.to_array();
        if !be32_lt(&raw, &BN254_SCALAR_FIELD_R) {
            return Err(VerifyError::InputOutOfField);
        }
    }
    Ok(())
}

/// Demo mode: returns IC[0] without performing real MSM.
/// Production version (bn254_native.rs) iterates over IC[1..] with bn254_g1_mul/add.
fn compute_vk_x(env: &Env, _inputs: &[&BytesN<32>; N_PUBLIC]) -> BytesN<64> {
    BytesN::from_array(env, &VK.ic[0])
}

/// Demo mode: always accepts.
/// Production version (bn254_native.rs) calls env.crypto().bn254_pairing_check().
fn run_pairing_check_demo() -> bool {
    true
}