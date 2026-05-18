import { CIRCUIT_DEPTH, POSEIDON_TAGS } from '@fluppy/core';

export const TREE_DEPTH = CIRCUIT_DEPTH;

export { POSEIDON_TAGS };

export interface CommitmentSource {
  getAllCommitments(): Promise<bigint[]>;
}

export interface BuiltTree {
  readonly root: bigint;
  readonly commitmentMap: ReadonlyMap<string, number>;
  readonly nodesByLevel: readonly ReadonlyMap<number, bigint>[];
  readonly zeroHashes: readonly bigint[];
}

export interface ServerMerkleProof {
  readonly pathElements: string[];
  readonly pathIndices: number[];
  readonly root: string;
}
