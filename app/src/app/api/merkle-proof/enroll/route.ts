import { NextRequest, NextResponse } from 'next/server';
import { getCommitmentSource } from '../../../../lib/merkle-server/commitment-source';
import { invalidateTreeCache } from '../../../../lib/merkle-server/tree-cache';

export const runtime = 'nodejs';

/**
 * POST /api/merkle-proof/enroll
 *
 * DEVELOPMENT-ONLY endpoint to enroll a commitment.
 * In production, replace with authenticated admin endpoint
 * gated by JWT/API key and rate-limited.
 *
 * Request: { commitment: "hex" }
 * Response: { enrolled: number }  // new whitelist size
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'enrollment_disabled_in_production' },
      { status: 403 },
    );
  }

  try {
    const { commitment } = await req.json();

    if (typeof commitment !== 'string' || !/^[0-9a-fA-F]{1,64}$/.test(commitment)) {
      return NextResponse.json(
        { error: 'invalid_commitment_format' },
        { status: 400 },
      );
    }

    const source  = getCommitmentSource();
    const bigVal  = BigInt('0x' + commitment);
    source.add(bigVal);
    invalidateTreeCache();

    return NextResponse.json({ enrolled: source.size() });
  } catch (err) {
    return NextResponse.json(
      { error: 'internal_server_error' },
      { status: 500 },
    );
  }
}