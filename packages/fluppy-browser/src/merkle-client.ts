/// <reference path="./types/circomlibjs.d.ts" />

import { buildPoseidon } from 'circomlibjs';

import {
  BN254_R,
  POSEIDON_TAGS,
} from '@fluppy/core';

export interface BrowserMerkleProof {
  readonly pathElements: bigint[];
  readonly pathIndices: number[];
  readonly root: bigint;
}

export interface EnrollCommitmentResult {
  readonly enrolled: number;
  readonly alreadyEnrolled?: boolean;
}

export interface MerkleClientOptions {
  readonly baseUrl?: string;
}

interface MerkleProofApiResponse {
  readonly pathElements: string[];
  readonly pathIndices: number[];
  readonly root: string;
}

let poseidonInstance: Awaited<ReturnType<typeof buildPoseidon>> | null = null;

async function getPoseidon(): Promise<Awaited<ReturnType<typeof buildPoseidon>>> {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }

  return poseidonInstance;
}

function resolveApiUrl(
  path: string,
  options?: MerkleClientOptions,
): string {
  const baseUrl = options?.baseUrl ?? '';

  return `${baseUrl}${path}`;
}

function validateSecret(secret: string): void {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('[Merkle] Invalid secret: must be 64-char hex string.');
  }
}

function secretToField(hexSecret: string): bigint {
  return BigInt(`0x${hexSecret}`) % BN254_R;
}

function commitmentToHex(commitment: bigint): string {
  return commitment
    .toString(16)
    .padStart(64, '0')
    .toLowerCase();
}

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const data = await response.json() as {
        error?: unknown;
        message?: unknown;
      };

      return String(
        data.error ??
        data.message ??
        fallback,
      );
    }

    return `${fallback}. HTTP ${response.status}`;
  } catch {
    return `${fallback}. HTTP ${response.status}`;
  }
}

/**
 * Computes a Merkle commitment locally from a secret.
 *
 * The raw secret never leaves the browser.
 */
export async function computeCommitment(secret: string): Promise<bigint> {
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

/**
 * Enrolls a locally computed commitment into the Merkle backend.
 *
 * This is intended for local/testnet/mock enrollment flows.
 * Production should use authenticated admin enrollment.
 */
export async function enrollCommitment(
  secret: string,
  options?: MerkleClientOptions,
): Promise<EnrollCommitmentResult> {
  const commitment = await computeCommitment(secret);
  const commitmentHex = commitmentToHex(commitment);

  const response = await fetch(
    resolveApiUrl('/api/merkle-proof/enroll', options),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commitment: commitmentHex,
      }),
    },
  );

  if (!response.ok) {
    const error = await readApiError(
      response,
      '[Merkle] Enrollment failed',
    );

    throw new Error(error);
  }

  return await response.json() as EnrollCommitmentResult;
}

/**
 * Fetches a Merkle membership proof from the backend.
 *
 * The backend receives only the commitment, never the raw secret.
 */
export async function getMerkleProof(
  secret: string,
  options?: MerkleClientOptions,
): Promise<BrowserMerkleProof> {
  const commitment = await computeCommitment(secret);
  const commitmentHex = commitmentToHex(commitment);

  console.log(
    '[Merkle] Requesting proof for commitment:',
    `${commitmentHex.slice(0, 16)}...`,
  );

  const response = await fetch(
    resolveApiUrl('/api/merkle-proof', options),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commitment: commitmentHex,
      }),
    },
  );

  if (!response.ok) {
    const error = await readApiError(
      response,
      '[Merkle] Proof request failed',
    );

    throw new Error(`[Merkle] ${error}`);
  }

  const data = await response.json() as MerkleProofApiResponse;

  console.log(
    `[Merkle] Proof received. Root: ${data.root.slice(0, 20)}...`,
  );

  return {
    pathElements: data.pathElements.map(element => BigInt(element)),
    pathIndices: data.pathIndices,
    root: BigInt(data.root),
  };
}
