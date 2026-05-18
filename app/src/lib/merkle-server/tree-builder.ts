import { buildPoseidon } from 'circomlibjs';

import {
  TREE_DEPTH,
  POSEIDON_TAGS,
  type BuiltTree,
} from './types';

let poseidonInstance: Awaited<ReturnType<typeof buildPoseidon>> | null = null;
let zeroHashCache: readonly bigint[] | null = null;

async function getPoseidon(): Promise<Awaited<ReturnType<typeof buildPoseidon>>> {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }

  return poseidonInstance;
}

async function getZeroHashes(): Promise<readonly bigint[]> {
  if (zeroHashCache) {
    return zeroHashCache;
  }

  const poseidon = await getPoseidon();
  const field = poseidon.F;
  const hashes: bigint[] = new Array(TREE_DEPTH + 1);

  hashes[0] = field.toObject(
    poseidon([
      POSEIDON_TAGS.LEAF,
      0n,
    ]),
  ) as bigint;

  for (let level = 1; level <= TREE_DEPTH; level++) {
    const previous = hashes[level - 1];

    if (previous === undefined) {
      throw new Error(`[tree-builder] Missing zero hash for level ${level - 1}`);
    }

    hashes[level] = field.toObject(
      poseidon([
        POSEIDON_TAGS.NODE,
        previous,
        previous,
      ]),
    ) as bigint;
  }

  zeroHashCache = hashes;

  return zeroHashCache;
}

function toCommitmentKey(commitment: bigint): string {
  return commitment
    .toString(16)
    .padStart(64, '0')
    .toLowerCase();
}

function getNodeOrZero(
  levelNodes: ReadonlyMap<number, bigint>,
  index: number,
  zeroHash: bigint,
): bigint {
  return levelNodes.get(index) ?? zeroHash;
}

/**
 * Builds a sparse Poseidon Merkle tree from a list of enrolled commitments.
 *
 * Hash rules must match the circuit:
 * - non-empty leaf = commitment
 * - empty leaf     = Poseidon(LEAF_TAG, 0)
 * - node           = Poseidon(NODE_TAG, left, right)
 *
 * This avoids building all 2^depth leaves. Only non-empty paths are stored.
 */
export async function buildMerkleTree(
  commitments: readonly bigint[],
): Promise<BuiltTree> {
  const poseidon = await getPoseidon();
  const field = poseidon.F;
  const treeSize = 2 ** TREE_DEPTH;

  if (commitments.length > treeSize) {
    throw new Error(
      `[tree-builder] Too many commitments: ${commitments.length} > ${treeSize}`,
    );
  }

  const zeroHashes = await getZeroHashes();
  const commitmentMap = new Map<string, number>();
  const mutableLevels: Map<number, bigint>[] = Array.from(
    { length: TREE_DEPTH + 1 },
    () => new Map<number, bigint>(),
  );

  const leafLevel = mutableLevels[0];

  if (!leafLevel) {
    throw new Error('[tree-builder] Missing leaf level');
  }

  for (let index = 0; index < commitments.length; index++) {
    const commitment = commitments[index];

    if (commitment === undefined) {
      throw new Error(`[tree-builder] Missing commitment at index ${index}`);
    }

    const key = toCommitmentKey(commitment);
    commitmentMap.set(key, index);
    leafLevel.set(index, commitment);
  }

  for (let level = 0; level < TREE_DEPTH; level++) {
    const currentLevel = mutableLevels[level];
    const nextLevel = mutableLevels[level + 1];
    const zeroHash = zeroHashes[level];

    if (!currentLevel || !nextLevel || zeroHash === undefined) {
      throw new Error(`[tree-builder] Invalid tree state at level ${level}`);
    }

    const parentIndices = new Set<number>();

    for (const nodeIndex of currentLevel.keys()) {
      parentIndices.add(Math.floor(nodeIndex / 2));
    }

    for (const parentIndex of parentIndices) {
      const leftIndex = parentIndex * 2;
      const rightIndex = leftIndex + 1;

      const leftHash = getNodeOrZero(
        currentLevel,
        leftIndex,
        zeroHash,
      );

      const rightHash = getNodeOrZero(
        currentLevel,
        rightIndex,
        zeroHash,
      );

      const parentHash = field.toObject(
        poseidon([
          POSEIDON_TAGS.NODE,
          leftHash,
          rightHash,
        ]),
      ) as bigint;

      nextLevel.set(parentIndex, parentHash);
    }
  }

  const rootLevel = mutableLevels[TREE_DEPTH];
  const defaultRoot = zeroHashes[TREE_DEPTH];

  if (!rootLevel || defaultRoot === undefined) {
    throw new Error('[tree-builder] Missing root level');
  }

  return {
    root: rootLevel.get(0) ?? defaultRoot,
    commitmentMap,
    nodesByLevel: mutableLevels,
    zeroHashes,
  };
}

/**
 * Extracts pathElements/pathIndices for a leaf at the given index.
 *
 * Sparse levels store only non-empty paths. Missing siblings are replaced with
 * the precomputed zero hash for that level.
 */
export function extractMerklePath(
  tree: BuiltTree,
  leafIndex: number,
): { pathElements: bigint[]; pathIndices: number[] } {
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];

  let index = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const levelNodes = tree.nodesByLevel[level];
    const zeroHash = tree.zeroHashes[level];

    if (!levelNodes || zeroHash === undefined) {
      throw new Error(`[tree-builder] Missing proof data at level ${level}`);
    }

    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const siblingHash = levelNodes.get(siblingIndex) ?? zeroHash;

    pathElements.push(siblingHash);
    pathIndices.push(isRight ? 1 : 0);

    index = Math.floor(index / 2);
  }

  return {
    pathElements,
    pathIndices,
  };
}
