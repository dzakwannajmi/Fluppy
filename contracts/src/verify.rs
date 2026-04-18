use soroban_sdk::{Env, Vec, BytesN, Bytes};

/// Verifies membership within a Merkle Tree using a provided proof path.
/// This enables Zero-Knowledge-style validation: confirming a user belongs 
/// to an authorized group without revealing their specific identity on-chain.
///
/// # Arguments
/// * `root` - The top-level cryptographic hash of the authorized member tree.
/// * `proof` - An ordered vector of hashes (Merkle Path) used to reconstruct the root.
/// * `leaf` - The hashed data of the specific member being verified.
pub fn verify_membership(env: &Env, root: BytesN<32>, proof: Vec<BytesN<32>>, leaf: BytesN<32>) -> bool {
    // Start with the hash of the leaf (the user's hashed identifier)
    let mut computed_hash = Bytes::from_array(env, &leaf.to_array());

    // Iteratively hash the proof nodes to climb up the Merkle Tree
    for node_hash in proof.iter() {
        let node_bytes = Bytes::from_array(env, &node_hash.to_array());
        
        // --- Canonical Sorting ---
        // We sort the hashes before concatenation to ensure a deterministic 
        // result regardless of the node's position (left/right) in the tree.
        // This is a security best practice for Merkle Tree implementations.
        let mut concat = Bytes::new(env);
        if computed_hash <= node_bytes {
            concat.append(&computed_hash);
            concat.append(&node_bytes);
        } else {
            concat.append(&node_bytes);
            concat.append(&computed_hash);
        }
        
        // Re-calculate the hash of the combined data using SHA-256
        computed_hash = env.crypto().sha256(&concat).into();
    }
    
    // The membership is valid if the reconstructed hash matches the trusted root
    computed_hash == Bytes::from_array(env, &root.to_array())
}