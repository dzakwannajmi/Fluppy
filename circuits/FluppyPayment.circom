pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";

// ─── Merkle Path Verifier ─────────────────────────────────────────────────────
// Reconstructs the Merkle root from a leaf and its sibling path.
// pathIndices[i] = 0 → current node is left child
// pathIndices[i] = 1 → current node is right child
template MerklePathVerifier(levels) {
    signal input  leaf;
    signal input  pathElements[levels];
    signal input  pathIndices[levels];
    signal output root;

    component hashers[levels];
    component muxL[levels];
    component muxR[levels];
    
    signal nodes[levels + 1];
    nodes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);

        muxL[i] = Mux1();
        muxL[i].c[0] <== nodes[i];
        muxL[i].c[1] <== pathElements[i];
        muxL[i].s    <== pathIndices[i];

        muxR[i] = Mux1();
        muxR[i].c[0] <== pathElements[i];
        muxR[i].c[1] <== nodes[i];
        muxR[i].s    <== pathIndices[i];

        hashers[i].inputs[0] <== muxL[i].out;
        hashers[i].inputs[1] <== muxR[i].out;

        nodes[i + 1] <== hashers[i].out;
    }

    root <== nodes[levels];
}

// ─── FluppyPayment ────────────────────────────────────────────────────────────
// levels = 20 → supports 2^20 ≈ 1M commitments
//
// Public signal ordering (MUST match verify.rs N_PUBLIC index order):
//   output  nullifier      → index 0  (SnarkJS emits outputs before inputs)
//   output  verifiedRoot   → index 1
//   input   merkleRoot     → index 2
//   input   recipientHash  → index 3
//   input   minAmount      → index 4
//   input   maxAmount      → index 5
template FluppyPayment(levels) {

    // ── Private witness (never revealed on-chain) ─────────────────────────
    signal input secret;
    signal input nonce;
    signal input amount;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // ── Public inputs ─────────────────────────────────────────────────────
    signal input merkleRoot;
    signal input recipientHash;
    signal input minAmount;
    signal input maxAmount;

    // ── Public outputs ────────────────────────────────────────────────────
    signal output nullifier;
    signal output verifiedRoot;

    // ── Constraint 1: Nullifier ───────────────────────────────────────────
    // nullifier = Poseidon(secret, nonce)
    // Binds to a unique spend event without revealing secret.
    component posNullifier = Poseidon(2);
    posNullifier.inputs[0] <== secret;
    posNullifier.inputs[1] <== nonce;
    nullifier <== posNullifier.out;

    // ── Constraint 2: Commitment leaf ────────────────────────────────────
    // leaf = Poseidon(secret, amount, recipientHash)
    // Commits payer to this exact recipient and amount at deposit time.
    component posLeaf = Poseidon(3);
    posLeaf.inputs[0] <== secret;
    posLeaf.inputs[1] <== amount;
    posLeaf.inputs[2] <== recipientHash;

    // ── Constraint 3: Merkle membership ──────────────────────────────────
    // Proves the committed leaf exists in the tree rooted at merkleRoot.
    component merkle = MerklePathVerifier(levels);
    merkle.leaf <== posLeaf.out;
    for (var i = 0; i < levels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
    verifiedRoot <== merkle.root;

    // Root equality — proof fails if path does not reconstruct merkleRoot.
    verifiedRoot === merkleRoot;

    // ── Constraint 4: Amount range bounds ────────────────────────────────
    // Enforces minAmount <= amount <= maxAmount (64-bit safe range).
    // Business logic (routing, fee split) stays in Soroban — not here.
    component gtMin = LessEqThan(64);
    gtMin.in[0] <== minAmount;
    gtMin.in[1] <== amount;
    gtMin.out   === 1;

    component ltMax = LessEqThan(64);
    ltMax.in[0] <== amount;
    ltMax.in[1] <== maxAmount;
    ltMax.out   === 1;
}

// ─── Entry point ─────────────────────────────────────────────────────────────
component main {
    public [merkleRoot, recipientHash, minAmount, maxAmount]
} = FluppyPayment(20);
