use soroban_sdk::{contracterror, BytesN};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VerifyError {
    InvalidProof        = 1,
    InputOutOfField     = 2,
    InputCountMismatch  = 3,
    EncodingError       = 4,
}

/// Number of public signals in the Groth16 proof.
/// MUST match the circuit's public input + output count.
///
/// Current value reflects post-chainId migration:
///   outputs: nullifier, verifiedRoot                      (2)
///   inputs:  merkleRoot, recipientHash, minAmount,
///            maxAmount, chainId                            (5)
///   total = 7
pub const N_PUBLIC: usize = 7;

/// Groth16 proof in Soroban wire format.
/// pi_a and pi_c are G1 points (64 bytes each).
/// pi_b is a G2 point (128 bytes).
pub struct Proof {
    pub pi_a: BytesN<64>,
    pub pi_b: BytesN<128>,
    pub pi_c: BytesN<64>,
}

/// Public inputs in SnarkJS output ordering.
///
/// CRITICAL: ordering MUST match IDX_* constants in payment.rs.
/// Any change here requires regenerating zkey and updating IC[] in vk_constants.rs.
pub struct PublicInputs<'a> {
    pub nullifier:      &'a BytesN<32>,
    pub verified_root:  &'a BytesN<32>,
    pub merkle_root:    &'a BytesN<32>,
    pub recipient_hash: &'a BytesN<32>,
    pub min_amount:     &'a BytesN<32>,
    pub max_amount:     &'a BytesN<32>,
    pub chain_id:       &'a BytesN<32>,
}

impl<'a> PublicInputs<'a> {
    /// Returns inputs as a fixed-size array in SnarkJS ordering.
    /// Used internally by verifier backends for IC iteration.
    pub fn as_array(&self) -> [&'a BytesN<32>; N_PUBLIC] {
        [
            self.nullifier,
            self.verified_root,
            self.merkle_root,
            self.recipient_hash,
            self.min_amount,
            self.max_amount,
            self.chain_id,
        ]
    }
}