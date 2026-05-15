'use client';

import { buildPoseidon } from 'circomlibjs';

import {
  BN254_R,
  POSEIDON_TAGS,
} from '@fluppy/core';

// ─────────────────────────────────────────────────────────────────────────────
// Client-side types
// ─────────────────────────────────────────────────────────────────────────────

export interface MerkleProof {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
}

// ─────────────────────────────────────────────────────────────────────────────
// Poseidon cache 
// ─────────────────────────────────────────────────────────────────────────────

let poseidonInstance: Awaited<ReturnType<typeof buildPoseidon>> | null = null;

async function getPoseidon(): Promise<Awaited<ReturnType<typeof buildPoseidon>>> {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }

  return poseidonInstance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function secretToField(hexSecret: string): bigint {
  return BigInt(`0x${hexSecret}`) % BN254_R;
}

function validateSecret(secret: string): void {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('[Merkle] Invalid secret: must be 64-char hex string.');
  }
}

async function readApiError(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const contentType = res.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const data = await res.json();

      return String(
        data.error ??
        data.message ??
        fallback,
      );
    }

    return `${fallback}. HTTP ${res.status}`;
  } catch {
    return `${fallback}. HTTP ${res.status}`;
  }
}

/**
 * Computes the commitment for a given secret:
 *
 *   commitment = Poseidon(LEAF_TAG, secretField)
 *
 * The raw secret never leaves the browser.
 */
async function computeCommitment(secret: string): Promise<bigint> {
  validateSecret(secret);

  const poseidon = await getPoseidon();
  const field = secretToField(secret);

  return poseidon.F.toObject(
    poseidon([
      POSEIDON_TAGS.LEAF,
      field,
    ]),
  ) as bigint;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enrolls a locally computed commitment into the backend mock whitelist.
 *
 * The backend receives only the commitment, never the raw secret.
 */
export async function addToMockWhitelist(secret: string): Promise<void> {
  const commitment = await computeCommitment(secret);
  const commitmentHex = commitment.toString(16).padStart(64, '0');

  const res = await fetch('/api/merkle-proof/enroll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      commitment: commitmentHex,
    }),
  });

  if (!res.ok) {
    const error = await readApiError(
      res,
      '[Merkle] Enrollment failed',
    );

    throw new Error(error);
  }

  const data = await res.json() as {
    enrolled: number;
  };

  console.log(
    `[Merkle] Commitment enrolled. Whitelist size: ${data.enrolled}`,
  );
}

/**
 * Fetches a Merkle membership proof from the backend.
 *
 * The commitment is computed locally from the secret.
 * The secret itself is never transmitted.
 */
export async function getMerkleProof(secret: string): Promise<MerkleProof> {
  const commitment = await computeCommitment(secret);
  const commitmentHex = commitment.toString(16).padStart(64, '0');

  console.log(
    '[Merkle] Requesting proof for commitment:',
    `${commitmentHex.slice(0, 16)}...`,
  );

  const res = await fetch('/api/merkle-proof', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      commitment: commitmentHex,
    }),
  });

  if (!res.ok) {
    const error = await readApiError(
      res,
      '[Merkle] Proof request failed',
    );

    throw new Error(`[Merkle] ${error}`);
  }

  const data = await res.json() as {
    pathElements: string[];
    pathIndices: number[];
    root: string;
  };

  console.log(
    `[Merkle] Proof received. Root: ${data.root.slice(0, 20)}...`,
  );

  return {
    pathElements: data.pathElements.map(element => BigInt(element)),
    pathIndices: data.pathIndices,
    root: BigInt(data.root),
  };
}