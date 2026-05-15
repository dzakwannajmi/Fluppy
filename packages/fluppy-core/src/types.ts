/**
 * Shared Fluppy SDK types.
 *
 * These types are intentionally framework-agnostic:
 * - no React
 * - no Next.js
 * - no browser-only APIs
 */

// ─────────────────────────────────────────────────────────────────────────────
// Proof types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Groth16 proof in Soroban wire format.
 *
 * Encoding:
 * - pi_a: 128 hex chars = 64 bytes
 * - pi_b: 256 hex chars = 128 bytes
 * - pi_c: 128 hex chars = 64 bytes
 * - publicSignals: 7 × 64 hex chars
 */
export interface PaymentProofOutput {
  readonly pi_a: string;
  readonly pi_b: string;
  readonly pi_c: string;
  readonly publicSignals: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
}

/**
 * Merkle membership proof returned by the Merkle API.
 */
export interface MerkleProof {
  readonly pathElements: readonly bigint[];
  readonly pathIndices: readonly number[];
  readonly root: bigint;
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Progress update emitted during proof generation.
 */
export interface ProofProgress {
  readonly stage: string;
  readonly pct: number;
}

/**
 * Progress callback used by browser SDK proof generation.
 */
export type ProgressCallback = (progress: ProofProgress) => void;

/**
 * Legacy progress callback shape used by the current app.
 *
 * Keep this for compatibility during migration.
 * Later, fluppy-browser can standardize on ProgressCallback.
 */
export type LegacyProgressCallback = (
  stage: string,
  pct: number,
) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Payment types
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'failed';

export interface PaymentResult {
  readonly txHash: string;
  readonly explorerUrl: string;
  readonly status: 'success';
}

// ─────────────────────────────────────────────────────────────────────────────
// Config types
// ─────────────────────────────────────────────────────────────────────────────

export interface FluppyCoreConfig {
  readonly contractId: string;
  readonly networkPassphrase: string;
  readonly rpcUrl: string;
}
