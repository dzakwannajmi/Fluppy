/**
 * @fluppy/browser — Fluppy ZK Payment Protocol browser SDK.
 *
 * This package provides browser-side implementations for:
 * - Merkle proof client operations
 * - ZK circuit artifact loading
 * - Groth16 proof generation and local verification
 * - Browser credential management
 * - Stellar/Freighter wallet integration
 *
 * This package must not import React, Next.js, Sentry, or UI code.
 */

export * from '@fluppy/core';

export {
  computeCommitment,
  enrollCommitment,
  getMerkleProof,
} from './merkle-client';

export type {
  BrowserMerkleProof,
  EnrollCommitmentResult,
  MerkleClientOptions,
} from './merkle-client';

export const FLUPPY_BROWSER_VERSION = '0.1.0';
