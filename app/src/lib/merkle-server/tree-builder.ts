import { buildPoseidon } from 'circomlibjs';
import { TREE_DEPTH, POSEIDON_TAGS, type BuiltTree } from './types';

let _poseidon: Awaited<ReturnType<typeof buildPoseidon>> | null = null;

async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

/**
 * Builds the full Poseidon Merkle tree from a list of commitments.
 *
 * Hash rules (MUST match circuit and frontend exactly):
 *   leaf_i      = commitment_i                       (already hashed by client)
 *   leaf_empty  = Poseidon(LEAF_TAG=2, 0)            (zero padding)
 *   node        = Poseidon(NODE_TAG=3, left, right)
 *
 * Returns BuiltTree with O(1) commitment index lookup.
 */
export async function buildMerkleTree(
  commitments: bigint[],
): Promise<BuiltTree> {
  const poseidon = await getPoseidon();
  const F        = poseidon.F;
  const treeSize = 2 ** TREE_DEPTH;

  if (commitments.length > treeSize) {
    throw new Error(
      `[tree-builder] Too many commitments: ${commitments.length} > ${treeSize}`,
    );
  }

  const zeroLeaf = F.toObject(
    poseidon([POSEIDON_TAGS.LEAF, 0n]),
  ) as bigint;

  // Build leaves layer with O(1) lookup map
  const leaves         = new Array<bigint>(treeSize);
  const commitmentMap  = new Map<string, number>();

  for (let i = 0; i < treeSize; i++) {
    if (i < commitments.length) {
      leaves[i] = commitments[i];
      const key = commitments[i].toString(16).padStart(64, '0');
      commitmentMap.set(key, i);
    } else {
      leaves[i] = zeroLeaf;
    }
  }

  // Build internal levels bottom-up
  const levels: bigint[][] = [leaves];
  let current = leaves;

  for (let d = 0; d < TREE_DEPTH; d++) {
    const next = new Array<bigint>(current.length / 2);
    for (let i = 0; i < current.length; i += 2) {
      const node = poseidon([POSEIDON_TAGS.NODE, current[i], current[i + 1]]);
      next[i / 2] = F.toObject(node) as bigint;
    }
    levels.push(next);
    current = next;
  }

  return {
    levels,
    root: levels[TREE_DEPTH][0],
    commitmentMap,
  };
}

/**
 * Extracts pathElements/pathIndices for a leaf at the given index.
 * Pure function — no side effects.
 */
export function extractMerklePath(
  tree:      BuiltTree,
  leafIndex: number,
): { pathElements: bigint[]; pathIndices: number[] } {
  const pathElements: bigint[] = [];
  const pathIndices:  number[] = [];
  let idx = leafIndex;

  for (let d = 0; d < TREE_DEPTH; d++) {
    const isRight = idx % 2 === 1;
    const sibIdx  = isRight ? idx - 1 : idx + 1;
    pathElements.push(tree.levels[d][sibIdx]);
    pathIndices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return { pathElements, pathIndices };
}