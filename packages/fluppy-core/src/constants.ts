/**
 * Fluppy Protocol Constants
 *
 * These values are shared between:
 *   - Circuit (FluppyPayment.circom)
 *   - Frontend (zkp.ts, merkle.ts)
 *   - Contract (verify.rs, payment.rs)
 *
 * DO NOT change without updating all three layers.
 */

// ─── BN254 field constants ───────────────────────────────────────────────────

/**
 * BN254 scalar field order.
 * All circuit inputs (secret, nonce, leaf, nullifier) must be < BN254_R.
 * Values >= BN254_R are reduced using modular arithmetic before use.
 */
export const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// ─── Circuit parameters ───────────────────────────────────────────────────────

/**
 * Merkle tree depth.
 * Supports up to 2^20 ≈ 1 million whitelisted commitments.
 * MUST match: FluppyPayment(20) in circuit.
 */
export const CIRCUIT_DEPTH = 20;

/**
 * Number of public signals emitted by the circuit.
 * Ordering (SnarkJS output-before-input convention):
 *   [0] nullifier       ← circuit output
 *   [1] verifiedRoot    ← circuit output
 *   [2] merkleRoot      ← public input
 *   [3] recipientHash   ← public input
 *   [4] minAmount       ← public input
 *   [5] maxAmount       ← public input
 *   [6] chainId         ← public input
 *
 * MUST match N_PUBLIC in contracts/src/verifier/types.rs.
 */
export const N_PUBLIC = 7 as const;

// ─── Poseidon domain separation tags ─────────────────────────────────────────

/**
 * Domain separation tags for Poseidon hashing.
 * Prepended as first input to prevent cross-context hash collisions.
 *
 * MUST match tags in FluppyPayment.circom and merkle-server/types.ts.
 */
export const POSEIDON_TAGS = {
  NULLIFIER: 1n, // Poseidon(1, secret, nonce)
  LEAF:      2n, // Poseidon(2, secret)
  NODE:      3n, // Poseidon(3, left, right)
} as const;

// ─── Payment bounds ───────────────────────────────────────────────────────────

/**
 * Default minimum payment amount (0 USDC in stroops).
 * Passed as minAmount public input to the circuit.
 */
export const DEFAULT_MIN_AMOUNT = 0n;

/**
 * Default maximum payment amount (1000 USDC in stroops).
 * 1 USDC = 10_000_000 stroops (7 decimal places on Stellar).
 */
export const DEFAULT_MAX_AMOUNT = BigInt(1000 * 10_000_000);

/**
 * USDC decimal places on Stellar.
 */
export const USDC_DECIMALS = 7;

/**
 * Converts human-readable USDC amount to stroops.
 * Example: usdcToStroops("1.50") → 15_000_000n
 */
export function usdcToStroops(amount: string): bigint {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed < 0) {
    throw new RangeError(`Invalid USDC amount: ${amount}`);
  }
  return BigInt(Math.floor(parsed * 10 ** USDC_DECIMALS));
}
