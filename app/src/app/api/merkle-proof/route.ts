import { NextRequest, NextResponse } from 'next/server';
import { getServerTree } from '../../../lib/merkle-server/tree-cache';
import { extractMerklePath } from '../../../lib/merkle-server/tree-builder';
import type { ServerMerkleProof } from '../../../lib/merkle-server/types';

// Force this route to run on Node.js runtime (not Edge)
// circomlibjs requires Node-native crypto
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ErrorResponse {
  error:   string;
  details?: string;
}

const ERROR_CODES = {
  INVALID_FORMAT:        'invalid_commitment_format',
  NOT_ENROLLED:          'commitment_not_enrolled',
  INTERNAL_ERROR:        'internal_server_error',
} as const;

/**
 * POST /api/merkle-proof
 *
 * Returns a Merkle membership proof for the given commitment.
 *
 * Request body:
 *   { commitment: "hex-encoded-bigint" }   // 1-64 chars, lowercase hex
 *
 * Response:
 *   { pathElements: string[], pathIndices: number[], root: string }
 *   All bigints are decimal-string encoded for JSON safety.
 *
 * Security:
 *   - Backend NEVER receives raw secret
 *   - Commitment is the hashed identity: Poseidon(LEAF_TAG, secret)
 *   - Even if backend is compromised, attacker cannot derive secrets
 */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<ServerMerkleProof | ErrorResponse>> {
  try {
    const body = await req.json();

    // ── Input validation ────────────────────────────────────────────────
    const { commitment } = body as { commitment?: unknown };

    if (typeof commitment !== 'string' || !/^[0-9a-fA-F]{1,64}$/.test(commitment)) {
      return NextResponse.json(
        { error: ERROR_CODES.INVALID_FORMAT },
        { status: 400 },
      );
    }

    // ── Normalize commitment to 64-char lowercase hex ──────────────────
    const normalizedHex = BigInt('0x' + commitment)
      .toString(16)
      .padStart(64, '0');

    // ── Tree lookup ─────────────────────────────────────────────────────
    const tree    = await getServerTree();
    const leafIdx = tree.commitmentMap.get(normalizedHex);

    if (leafIdx === undefined) {
      return NextResponse.json(
        { error: ERROR_CODES.NOT_ENROLLED },
        { status: 404 },
      );
    }

    // ── Extract proof path ──────────────────────────────────────────────
    const { pathElements, pathIndices } = extractMerklePath(tree, leafIdx);

    return NextResponse.json({
      pathElements: pathElements.map(e => e.toString()),
      pathIndices,
      root:         tree.root.toString(),
    });
  } catch (err) {
    console.error('[/api/merkle-proof] error:', err);
    return NextResponse.json(
      {
        error:   ERROR_CODES.INTERNAL_ERROR,
        details: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}