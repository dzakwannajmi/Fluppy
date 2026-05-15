//! Groth16 verifier module — modular backend dispatch.
//!
//! Backend selection (compile-time):
//!   default:                     bn254_demo (no real pairing — testnet)
//!   --features bn254_native:     bn254_native (real pairing — production)
//!
//! Public API consumers (payment.rs, tests) interact only with verify_proof().
//! Backend implementations are private to this module.

pub mod types;
pub mod vk_constants;

mod bn254_demo;
#[cfg(feature = "bn254_native")]
mod bn254_native;

pub use types::{Proof, PublicInputs, VerifyError, N_PUBLIC};

use soroban_sdk::Env;

#[cfg(not(feature = "bn254_native"))]
use bn254_demo as backend;
#[cfg(feature = "bn254_native")]
use bn254_native as backend;

/// Verifies a Groth16 proof against the public inputs.
///
/// Returns Ok(()) on success, or VerifyError on failure.
/// Backend implementation is selected at compile time.
pub fn verify_proof(env: &Env, proof: &Proof, inputs: &PublicInputs) -> Result<(), VerifyError> {
    backend::verify_proof_impl(env, proof, inputs)
}
