'use client';

import {
  generateZkProof as generateBrowserZkProof,
  verifyProofLocally as verifyBrowserProofLocally,
  type PaymentProofOutput,
  type ProofProgressCallback,
} from '@fluppy/browser';

import type { MerkleProof } from './merkle';

export type {
  PaymentProofOutput,
  ProofProgressCallback,
};

export interface ProofProgress {
  readonly stage: string;
  readonly pct: number;
}

export interface GenerateProofOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: ProofProgressCallback;
}

export {
  computeChainId,
  computeRecipientHash,
} from '@fluppy/browser';

/**
 * Compatibility wrapper for the legacy app API.
 *
 * The implementation now lives in @fluppy/browser, but useFluppy.ts can keep
 * calling the old positional signature during SDK-1B migration.
 */
export async function generateZkProof(
  secret: string,
  merkleProof: MerkleProof,
  recipient: string,
  amount: bigint,
  onProgress?: ProofProgressCallback,
  abortSignal?: AbortSignal,
): Promise<PaymentProofOutput> {
  if (typeof window === 'undefined') {
    throw new Error('[ZKP] Client-side only');
  }

  const networkPassphrase =
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

  if (!networkPassphrase) {
    throw new Error(
      '[ZKP] NEXT_PUBLIC_NETWORK_PASSPHRASE missing',
    );
  }

  return await generateBrowserZkProof({
    secret,
    merkleProof,
    recipient,
    amount,
    networkPassphrase,
    ...(onProgress ? { onProgress } : {}),
    ...(abortSignal ? { signal: abortSignal } : {}),
  });
}

/**
 * Compatibility wrapper for local proof verification.
 */
export async function verifyProofLocally(
  proof: PaymentProofOutput,
): Promise<boolean> {
  return await verifyBrowserProofLocally(proof);
}
