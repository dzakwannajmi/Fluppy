use soroban_sdk::{contracttype, Address, BytesN, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentConfig {
    pub usdc_token: Address,
    pub dev_ops: Address,
    pub fee_percentage: i128, 
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)] // Tambahkan derive ini agar aman
pub struct ZKProof {
    pub root: BytesN<32>,      
    pub proof: Vec<BytesN<32>>,
    pub leaf: BytesN<32>,      
}