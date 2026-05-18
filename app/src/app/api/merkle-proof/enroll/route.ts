import { NextRequest, NextResponse } from 'next/server';

import { getCommitmentSource } from '../../../../lib/merkle-server/commitment-source';
import { invalidateTreeCache } from '../../../../lib/merkle-server/tree-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EnrollResponse {
  enrolled: number;
  alreadyEnrolled: boolean;
}

interface ErrorResponse {
  error: string;
}

function isMockEnrollmentAllowed(): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return process.env.ALLOW_MOCK_ENROLLMENT === 'true';
}

function normalizeCommitment(input: unknown): bigint | null {
  if (typeof input !== 'string') {
    return null;
  }

  if (!/^[0-9a-fA-F]{1,64}$/.test(input)) {
    return null;
  }

  return BigInt(`0x${input}`);
}

/**
 * POST /api/merkle-proof/enroll
 *
 * Development/testnet endpoint for enrolling a commitment.
 * Production should use an authenticated admin enrollment flow.
 */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<EnrollResponse | ErrorResponse>> {
  if (!isMockEnrollmentAllowed()) {
    return NextResponse.json(
      { error: 'enrollment_disabled_in_production' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json() as {
      commitment?: unknown;
    };

    const commitment = normalizeCommitment(body.commitment);

    if (commitment === null) {
      return NextResponse.json(
        { error: 'invalid_commitment_format' },
        { status: 400 },
      );
    }

    const source = getCommitmentSource();
    const added = source.add(commitment);

    if (added) {
      invalidateTreeCache();
    }

    return NextResponse.json({
      enrolled: source.size(),
      alreadyEnrolled: !added,
    });
  } catch (err: unknown) {
    console.error('[/api/merkle-proof/enroll] error:', err);

    return NextResponse.json(
      { error: 'internal_server_error' },
      { status: 500 },
    );
  }
}
