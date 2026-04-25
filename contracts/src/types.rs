use soroban_sdk::crypto::bn254::{Bn254G1Affine, Bn254G2Affine};
use soroban_sdk::{contracttype, Address, BytesN, Vec};


#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentConfig {
    pub usdc_token: Address,
    pub dev_ops: Address,
    pub fee_percentage: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct ZKProof {
    pub g1_points: Vec<Bn254G1Affine>,
    pub g2_points: Vec<Bn254G2Affine>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Config,
    IsPaused,
    MerkleRoot,
    Nullifier(BytesN<32>),
}