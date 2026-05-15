//! BN254 production backend — STUB ONLY.
//!
//! This module is compiled only when --features bn254_native is set.
//! Currently unimplemented because soroban-sdk has not yet exposed
//! the required BN254 host functions:
//!   - env.crypto().bn254_g1_mul()
//!   - env.crypto().bn254_g1_add()
//!   - env.crypto().bn254_pairing_check()
//!
//! Once available, this module replaces bn254_demo.rs with zero changes
//! to payment.rs or test.rs — that's the entire point of modularization.

#![allow(dead_code, unused_variables)]

use soroban_sdk::Env;
use super::types::{Proof, PublicInputs, VerifyError};

pub fn verify_proof_impl(
    env:    &Env,
    proof:  &Proof,
    inputs: &PublicInputs,
) -> Result<(), VerifyError> {
    // TODO: implement real MSM
    //   let mut acc = Bytes::from_slice(env, &VK.ic[0]);
    //   for (i, input) in inputs.as_array().iter().enumerate() {
    //       let scalar = bytes32_to_u256(env, &input.to_array());
    //       let ic_pt  = Bytes::from_slice(env, &VK.ic[i + 1]);
    //       let term   = env.crypto().bn254_g1_mul(ic_pt, scalar);
    //       acc        = env.crypto().bn254_g1_add(acc, term);
    //   }

    // TODO: implement real pairing check
    //   let g1 = vec![&env, pi_a, neg_alpha, neg_vk_x, neg_pi_c];
    //   let g2 = vec![&env, pi_b, beta, gamma, delta];
    //   let valid = env.crypto().bn254_pairing_check(g1, g2);

    unimplemented!(
        "bn254_native backend not yet implemented — \
         waiting for soroban-sdk BN254 host function exposure"
    )
}