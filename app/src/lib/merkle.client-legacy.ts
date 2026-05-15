// app/src/lib/merkle.ts
// Merkle layer — Poseidon tree membership proof.
//
// LEAF FORMULA (must match circuit exactly):
//   leaf = Poseidon(LEAF_TAG, secret)
//
// INTERNAL NODE FORMULA:
//   node = Poseidon(NODE_TAG, left, right)
//
// Domain separation prevents cross-domain hash collisions:
//   nullifier != leaf != merkle node
//
// Root only changes when new secrets are added to the whitelist.
// Amount and recipient are verified separately by the circuit constraints.

'use client';

import { buildPoseidon } from 'circomlibjs';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MerkleProof {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
}

interface CommitmentEntry {
  secret: string; // 64-char hex — identity only, no amount/recipient
}

interface BuiltTree {
  levels: bigint[][];
  root: bigint;
}

interface TreeCache {
  tree: BuiltTree;
  snapshot: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Must match FluppyPayment(20) in circuit */
const TREE_DEPTH = 20;

/**
 * BN254 scalar field order.
 * All Poseidon inputs must be reduced mod this value.
 */
const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Poseidon domain separation tags.
 *
 * MUST match FluppyPayment.circom exactly.
 *
 * Prevents cross-domain hash collisions:
 *   - nullifier != leaf != merkle node
 */
const POSEIDON_TAGS = {
  NULLIFIER: 1n,
  LEAF: 2n,
  NODE: 3n,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────

let MOCK_WHITELIST: CommitmentEntry[] = [];
let _poseidon: Awaited<ReturnType<typeof buildPoseidon>> | null = null;
let _treeCache: TreeCache | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

/**
 * Converts a 64-char hex secret to a BN254-safe field element.
 * Reduces mod BN254_R to prevent field overflow.
 * MUST be identical to secretToBn254FieldElement() in zkp.ts.
 */
function secretToField(hexSecret: string): bigint {
  return BigInt('0x' + hexSecret) % BN254_R;
}

/**
 * Builds the full Poseidon Merkle tree from the whitelist.
 *
 * Leaf formula: Poseidon(secret)
 *   - Matches circuit constraint: posLeaf.inputs[0] <== secret
 *   - Zero-padding: Poseidon(0n) for empty slots
 *
 * Internal nodes: Poseidon(left, right)
 */
async function buildTree(entries: CommitmentEntry[]): Promise<BuiltTree> {
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const treeSize = 2 ** TREE_DEPTH;

  console.log(`[Merkle] Building tree (depth=${TREE_DEPTH}, leaves=${treeSize})...`);

  // ── Build leaf layer ────────────────────────────────────────────────────
  const leaves: bigint[] = new Array(treeSize);

  // Pre-compute zero leaf once (Poseidon(0n)) — reused for all empty slots
  const zeroLeaf = F.toObject(
    poseidon([POSEIDON_TAGS.LEAF, 0n])
  ) as bigint;

  for (let i = 0; i < treeSize; i++) {
    if (i < entries.length) {
      const field = secretToField(entries[i].secret);
      const leafHash = poseidon([
        POSEIDON_TAGS.LEAF,
        field,
      ]);

      leaves[i] = F.toObject(leafHash) as bigint;
    } else {
      leaves[i] = zeroLeaf;
    }
  }

  // ── Build internal levels ───────────────────────────────────────────────
  const levels: bigint[][] = [leaves];
  let current = leaves;

  for (let d = 0; d < TREE_DEPTH; d++) {
    const next: bigint[] = new Array(current.length / 2);
    for (let i = 0; i < current.length; i += 2) {
      const node = poseidon([
        POSEIDON_TAGS.NODE,
        current[i],
        current[i + 1] ?? 0n,
      ]);
      next[i / 2] = F.toObject(node) as bigint;
    }
    levels.push(next);
    current = next;
  }

  const root = levels[TREE_DEPTH][0];
  console.log(`[Merkle] Tree built. Root: ${root.toString().slice(0, 20)}...`);
  return { levels, root };
}

function extractPath(
  levels: bigint[][],
  leafIndex: number,
): { pathElements: bigint[]; pathIndices: number[] } {
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  let idx = leafIndex;

  for (let d = 0; d < TREE_DEPTH; d++) {
    const isRight = idx % 2 === 1;
    pathElements.push(levels[d][isRight ? idx - 1 : idx + 1] ?? 0n);
    pathIndices.push(isRight ? 1 : 0);
    idx = Math.floor(idx / 2);
  }

  return { pathElements, pathIndices };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * addToMockWhitelist(secret)
 *
 * Registers a secret into the in-memory whitelist.
 * Called by useFluppy.ts after unlocking credential.
 *
 * Only accepts secret — amount and recipient are NOT part of the leaf anymore.
 * This ensures root stability across different payment amounts.
 */
export function addToMockWhitelist(secret: string): void {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('[Merkle] Invalid secret: must be 64-char hex string.');
  }
  if (!MOCK_WHITELIST.some(e => e.secret === secret)) {
    MOCK_WHITELIST.push({ secret });
    _treeCache = null; // invalidate cache — tree must be rebuilt
    console.log(`[Merkle] Secret registered. Whitelist size: ${MOCK_WHITELIST.length}`);
  }
}

/**
 * getMerkleProof(secret)
 *
 * Returns a Merkle membership proof for the given secret.
 * Uses cached tree if whitelist has not changed.
 *
 * Root is guaranteed stable as long as:
 *   1. The same secrets are in the whitelist
 *   2. The same Poseidon parameters are used
 *
 * PRODUCTION: Replace this function body with a backend API call.
 * Send the commitment hash (NOT the secret) to the backend.
 */
export async function getMerkleProof(secret: string): Promise<MerkleProof> {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('[Merkle] Invalid secret: must be 64-char hex string.');
  }
  if (MOCK_WHITELIST.length === 0) {
    throw new Error(
      '[Merkle] Whitelist is empty. Call addToMockWhitelist(secret) first.'
    );
  }

  const poseidon = await getPoseidon();
  const F = poseidon.F;

  // ── Tree cache ──────────────────────────────────────────────────────────
  const snapshot = JSON.stringify(MOCK_WHITELIST);
  if (!_treeCache || _treeCache.snapshot !== snapshot) {
    _treeCache = { tree: await buildTree(MOCK_WHITELIST), snapshot };
  }
  const { levels, root } = _treeCache.tree;

  // ── Find leaf ───────────────────────────────────────────────────────────
  // Compute leaf EXACTLY like the circuit:
  //
  //   leaf = Poseidon(LEAF_TAG, secret)
  //
  // Domain separation MUST remain synchronized
  // between frontend and circuit.
  const field = secretToField(secret);
  const leafHash = F.toObject(
    poseidon([
      POSEIDON_TAGS.LEAF,
      field,
    ])
  ) as bigint;
  const leafIdx = levels[0].findIndex(l => l === leafHash);

  if (leafIdx === -1) {
    throw new Error(
      '[Merkle] Secret not found. ' +
      'Ensure addToMockWhitelist(secret) was called with this exact secret.'
    );
  }

  const { pathElements, pathIndices } = extractPath(levels, leafIdx);

  console.log('[Merkle] Proof generated successfully.');
  console.log(`[Merkle] Leaf index : ${leafIdx}`);
  console.log(`[Merkle] Root       : ${root.toString().slice(0, 20)}...`);

  return { pathElements, pathIndices, root };
}
  
/**
 * getMockRoot()
 * Returns current Merkle root as decimal string.
 * Use this to sync the contract: set_merkle_root --new_root <hex>
 */
export async function getMockRoot(): Promise<string> {
  if (MOCK_WHITELIST.length === 0) {
    throw new Error('[Merkle] Whitelist is empty.');
  }
  const snapshot = JSON.stringify(MOCK_WHITELIST);
  if (!_treeCache || _treeCache.snapshot !== snapshot) {
    _treeCache = { tree: await buildTree(MOCK_WHITELIST), snapshot };
  }
  return _treeCache.tree.root.toString();
}

export function clearMockWhitelist(): void {
  MOCK_WHITELIST = [];
  _treeCache = null;
  console.log('[Merkle] Whitelist and cache cleared.');
}