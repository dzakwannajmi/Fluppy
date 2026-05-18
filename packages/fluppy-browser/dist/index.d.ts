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
 * artifacts.ts — Circuit artifact loader for Fluppy browser SDK.
 *
 * Responsibilities:
 * - Define default artifact paths
 * - Fetch and cache WASM and ZKey as Uint8Array
 * - Fetch and cache verification_key.json
 * - Validate artifact availability
 * - Expose cache reset for testing and development
 *
 * This module must not import React, Next.js, Sentry, or UI code.
 */
interface CircuitArtifactPaths {
    readonly wasmPath: string;
    readonly zkeyPath: string;
    readonly verificationKeyPath: string;
}
interface CircuitArtifacts {
    readonly wasm: Uint8Array;
    readonly zkey: Uint8Array;
}
interface LoadArtifactOptions {
    readonly paths?: Partial<CircuitArtifactPaths>;
    readonly cache?: RequestCache;
    readonly signal?: AbortSignal;
}
declare function getDefaultCircuitArtifactPaths(): CircuitArtifactPaths;
declare function loadCircuitArtifacts(options?: LoadArtifactOptions): Promise<CircuitArtifacts>;
declare function loadVerificationKey(options?: LoadArtifactOptions): Promise<unknown>;
declare function validateCircuitArtifacts(options?: LoadArtifactOptions): Promise<void>;
declare function clearCircuitArtifactCache(): void;

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

export { type BrowserMerkleProof, type CircuitArtifactPaths, type CircuitArtifacts, type EnrollCommitmentResult, FLUPPY_BROWSER_VERSION, type LoadArtifactOptions, type MerkleClientOptions, clearCircuitArtifactCache, computeCommitment, enrollCommitment, getDefaultCircuitArtifactPaths, getMerkleProof, loadCircuitArtifacts, loadVerificationKey, validateCircuitArtifacts };
