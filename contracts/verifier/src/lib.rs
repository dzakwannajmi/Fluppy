#![no_std]
use soroban_sdk::{
    contract, contractimpl,
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine},
    Env, Vec,
};

#[contract]
pub struct UltrahonkVerifier;

#[contractimpl]
impl UltrahonkVerifier {
    pub fn verify_proof(
        env: Env,
        g1_points: Vec<Bn254G1Affine>,
        g2_points: Vec<Bn254G2Affine>,
    ) -> bool {
        env.crypto().bn254().pairing_check(g1_points, g2_points)
    }
}
