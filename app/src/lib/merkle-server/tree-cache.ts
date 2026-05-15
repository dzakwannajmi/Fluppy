import { buildMerkleTree } from './tree-builder';
import { getCommitmentSource } from './commitment-source';
import type { BuiltTree } from './types';

// Module-level state — single tree instance per process
let _cachedTree:      BuiltTree | null               = null;
let _cachedSnapshot:  string                         = '';
let _buildPromise:    Promise<BuiltTree> | null      = null;

/**
 * Returns the current Merkle tree, building it lazily on first call.
 *
 * Concurrency safety:
 *   - Multiple concurrent requests during first build share the same promise
 *   - Subsequent requests return cached tree instantly
 *   - Cache invalidates only when commitment source changes (snapshot diff)
 *
 * In production, replace snapshot-based invalidation with explicit
 * event-driven rebuild (e.g. listen to admin enrollment events).
 */
export async function getServerTree(): Promise<BuiltTree> {
  const source       = getCommitmentSource();
  const commitments  = await source.getAllCommitments();
  const snapshot     = commitments.map(c => c.toString(16)).join('|');

  // Cache hit
  if (_cachedTree && _cachedSnapshot === snapshot) {
    return _cachedTree;
  }

  // Build already in flight — wait for it
  if (_buildPromise) {
    return _buildPromise;
  }

  // Start new build
  _buildPromise = (async () => {
    console.log(`[tree-cache] Building tree for ${commitments.length} commitments...`);
    const start = Date.now();
    const tree  = await buildMerkleTree(commitments);
    console.log(`[tree-cache] Tree built in ${Date.now() - start}ms`);

    _cachedTree     = tree;
    _cachedSnapshot = snapshot;
    _buildPromise   = null;

    return tree;
  })();

  try {
    return await _buildPromise;
  } catch (err) {
    _buildPromise = null; // allow retry on failure
    throw err;
  }
}

/** Forces tree rebuild on next request. Use after commitment enrollment. */
export function invalidateTreeCache(): void {
  _cachedTree     = null;
  _cachedSnapshot = '';
  _buildPromise   = null;
}