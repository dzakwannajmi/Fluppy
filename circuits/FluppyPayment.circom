pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// ─── Domain separation constants ─────────────────────────────────────────────
// These tags are prepended to every Poseidon call to prevent cross-context
// hash collisions. Values are arbitrary small BN254-safe integers.
// MUST match POSEIDON_TAGS in merkle.ts and zkp.ts exactly.
//
//   NULLIFIER_TAG = 1  → prevents forging nullifier from a merkle node
//   LEAF_TAG      = 2  → prevents forging leaf from a nullifier
//   NODE_TAG      = 3  → prevents forging node from a leaf or nullifier

// ─── Merkle Path Verifier ─────────────────────────────────────────────────────
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
        // NODE_TAG = 3 — domain-separated internal node hashing
        hashers[i] = Poseidon(3);
        hashers[i].inputs[0] <== 3;  // NODE_TAG

        muxL[i] = Mux1();
        muxL[i].c[0] <== nodes[i];
        muxL[i].c[1] <== pathElements[i];
        muxL[i].s    <== pathIndices[i];

        muxR[i] = Mux1();
        muxR[i].c[0] <== pathElements[i];
        muxR[i].c[1] <== nodes[i];
        muxR[i].s    <== pathIndices[i];

        hashers[i].inputs[1] <== muxL[i].out;
        hashers[i].inputs[2] <== muxR[i].out;

        nodes[i + 1] <== hashers[i].out;
    }

    root <== nodes[levels];
}

// ─── FluppyPayment ────────────────────────────────────────────────────────────
//
// Public signal ordering (MUST match verify.rs IDX_* constants):
//   output nullifier      → index 0
//   output verifiedRoot   → index 1
//   input  merkleRoot     → index 2
//   input  recipientHash  → index 3
//   input  minAmount      → index 4
//   input  maxAmount      → index 5
//
// Domain separation:
//   nullifier = Poseidon(1, secret, nonce)  — NULLIFIER_TAG = 1
//   leaf      = Poseidon(2, secret)         — LEAF_TAG      = 2
//   node      = Poseidon(3, left, right)    — NODE_TAG      = 3

template FluppyPayment(levels) {

    // ── Private inputs ────────────────────────────────────────────────────────
    signal input secret;
    signal input nonce;
    signal input amount;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // ── Public inputs ─────────────────────────────────────────────────────────
    signal input merkleRoot;
    signal input recipientHash;
    signal input minAmount;
    signal input maxAmount;
    signal input chainId;

    // chainId does NOT need internal constraints — it is bound to the proof
    // automatically via Groth16 public input mechanism.
    // The contract enforces: chainId === expected_chain_id(env)

    // ── Public outputs ────────────────────────────────────────────────────────
    signal output nullifier;
    signal output verifiedRoot;

    // ── Constraint 1: Amount bit-length enforcement ───────────────────────────
    // Forces `amount` to be representable in 64 bits.
    // Prevents arithmetic overflow in LessEqThan and protects range checks
    // against malicious witness values beyond u64.
    component amountBits = Num2Bits(64);
    amountBits.in <== amount;

    // ── Constraint 2: Nullifier with domain separation ────────────────────────
    // nullifier = Poseidon(NULLIFIER_TAG=1, secret, nonce)
    // Domain tag prevents nullifier from being forged using a Merkle node
    // that happens to hash to the same value via Poseidon(left, right).
    component posNullifier = Poseidon(3);
    posNullifier.inputs[0] <== 1;       // NULLIFIER_TAG
    posNullifier.inputs[1] <== secret;
    posNullifier.inputs[2] <== nonce;
    nullifier <== posNullifier.out;

    // ── Constraint 3: Membership leaf with domain separation ──────────────────
    // leaf = Poseidon(LEAF_TAG=2, secret)
    // Domain tag prevents leaf from being confused with a nullifier
    // even though both take `secret` as input.
    component posLeaf = Poseidon(2);
    posLeaf.inputs[0] <== 2;            // LEAF_TAG
    posLeaf.inputs[1] <== secret;

    // ── Constraint 4: Merkle membership proof ─────────────────────────────────
    component merkle = MerklePathVerifier(levels);
    merkle.leaf <== posLeaf.out;
    for (var i = 0; i < levels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
    verifiedRoot <== merkle.root;

    // Root equality — proof fails if path does not reconstruct merkleRoot
    verifiedRoot === merkleRoot;

    // ── Constraint 5: Amount range check ─────────────────────────────────────
    // minAmount <= amount <= maxAmount
    // Combined with Num2Bits(64) above, this fully constrains amount.
    component gtMin = LessEqThan(64);
    gtMin.in[0] <== minAmount;
    gtMin.in[1] <== amount;
    gtMin.out   === 1;

    component ltMax = LessEqThan(64);
    ltMax.in[0] <== amount;
    ltMax.in[1] <== maxAmount;
    ltMax.out   === 1;

    // ── Note on recipientHash ─────────────────────────────────────────────────
    // recipientHash is declared as a public input in `component main`.
    // It is bound to the proof automatically via the Groth16 public input
    // mechanism — no explicit signal consumer (`_ <==`) is needed.
    // The contract re-derives and compares recipientHash in payment.rs.
}

component main {
    public [merkleRoot, recipientHash, minAmount, maxAmount, chainId]
} = FluppyPayment(20);