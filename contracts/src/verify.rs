use soroban_sdk::{Env, Vec, BytesN, Bytes};

pub fn verify_membership(env: &Env, root: BytesN<32>, proof: Vec<BytesN<32>>, leaf: BytesN<32>) -> bool {
    let mut computed_hash = Bytes::from_array(env, &leaf.to_array());

    for node_hash in proof.iter() {
        let node_bytes = Bytes::from_array(env, &node_hash.to_array());
        
        // Pengurutan hash agar deterministik (Canonical Merkle Tree)
        let mut concat = Bytes::new(env);
        if computed_hash <= node_bytes {
            concat.append(&computed_hash);
            concat.append(&node_bytes);
        } else {
            concat.append(&node_bytes);
            concat.append(&computed_hash);
        }
        
        computed_hash = env.crypto().sha256(&concat).into();
    }
    
    // Bandingkan hasilnya dengan root
    computed_hash == Bytes::from_array(env, &root.to_array())
}