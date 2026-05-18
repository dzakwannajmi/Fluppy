export * from '@fluppy/core';

interface BrowserMerkleProof {
    readonly pathElements: bigint[];
    readonly pathIndices: number[];
    readonly root: bigint;
}
interface EnrollCommitmentResult {
    readonly enrolled: number;
    readonly alreadyEnrolled?: boolean;
}
interface MerkleClientOptions {
    readonly baseUrl?: string;
}
/**
 * Computes a Merkle commitment locally from a secret.
 *
 * The raw secret never leaves the browser.
 */
declare function computeCommitment(secret: string): Promise<bigint>;
/**
 * Enrolls a locally computed commitment into the Merkle backend.
 *
 * This is intended for local/testnet/mock enrollment flows.
 * Production should use authenticated admin enrollment.
 */
declare function enrollCommitment(secret: string, options?: MerkleClientOptions): Promise<EnrollCommitmentResult>;
/**
 * Fetches a Merkle membership proof from the backend.
 *
 * The backend receives only the commitment, never the raw secret.
 */
declare function getMerkleProof(secret: string, options?: MerkleClientOptions): Promise<BrowserMerkleProof>;

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

declare const FLUPPY_BROWSER_VERSION = "0.1.0";

export { type BrowserMerkleProof, type EnrollCommitmentResult, FLUPPY_BROWSER_VERSION, type MerkleClientOptions, computeCommitment, enrollCommitment, getMerkleProof };
