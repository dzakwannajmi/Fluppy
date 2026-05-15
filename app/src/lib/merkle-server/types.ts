// Server-side types for Merkle proof generation.
// Kept separate from client types to avoid leaking server internals.

export interface ServerMerkleProof {
  pathElements: string[];   // decimal strings — bigint-safe transport
  pathIndices:  number[];
  root:         string;     // decimal string
}

export interface CommitmentSource {
  /** Returns all enrolled commitments as bigints in stable order. */
  getAllCommitments(): Promise<bigint[]>;
}

export interface BuiltTree {
  levels:        bigint[][];
  root:          bigint;
  commitmentMap: Map<string, number>; // hex(commitment) → leaf index
}

export const TREE_DEPTH      = 20;
export const POSEIDON_TAGS   = {
  LEAF: 2n,
  NODE: 3n,
} as const;