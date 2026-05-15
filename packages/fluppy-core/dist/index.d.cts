import { Networks } from '@stellar/stellar-sdk';

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
/**
 * BN254 scalar field order.
 * All circuit inputs (secret, nonce, leaf, nullifier) must be < BN254_R.
 * Values >= BN254_R are reduced using modular arithmetic before use.
 */
declare const BN254_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/**
 * Merkle tree depth.
 * Supports up to 2^20 ≈ 1 million whitelisted commitments.
 * MUST match: FluppyPayment(20) in circuit.
 */
declare const CIRCUIT_DEPTH = 20;
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
declare const N_PUBLIC: 7;
/**
 * Domain separation tags for Poseidon hashing.
 * Prepended as first input to prevent cross-context hash collisions.
 *
 * MUST match tags in FluppyPayment.circom and merkle-server/types.ts.
 */
declare const POSEIDON_TAGS: {
    readonly NULLIFIER: 1n;
    readonly LEAF: 2n;
    readonly NODE: 3n;
};
/**
 * Default minimum payment amount (0 USDC in stroops).
 * Passed as minAmount public input to the circuit.
 */
declare const DEFAULT_MIN_AMOUNT = 0n;
/**
 * Default maximum payment amount (1000 USDC in stroops).
 * 1 USDC = 10_000_000 stroops (7 decimal places on Stellar).
 */
declare const DEFAULT_MAX_AMOUNT: bigint;
/**
 * USDC decimal places on Stellar.
 */
declare const USDC_DECIMALS = 7;
/**
 * Converts human-readable USDC amount to stroops.
 * Example: usdcToStroops("1.50") → 15_000_000n
 */
declare function usdcToStroops(amount: string): bigint;

/**
 * Fluppy error model.
 *
 * All SDK-level errors should extend FluppyError so app, browser SDK,
 * and React SDK can handle errors consistently.
 */
type FluppyErrorAction = 'retry' | 'contact_support' | 'reconnect';
type FluppyErrorCode = 'NOT_INITIALIZED' | 'ALREADY_INITIALIZED' | 'NOT_ADMIN' | 'NULLIFIER_SPENT' | 'INVALID_PROOF' | 'RECIPIENT_MISMATCH' | 'INVALID_AMOUNT' | 'CONTRACT_PAUSED' | 'INVALID_INPUT_COUNT' | 'ARITHMETIC_OVERFLOW' | 'CIRCUIT_ROOT_MISMATCH' | 'ROOT_MISMATCH' | 'CHAIN_ID_MISMATCH' | 'NOT_ENROLLED' | 'INVALID_COMMITMENT' | 'TIMEOUT' | 'NETWORK_ERROR' | 'USER_REJECTED' | 'WALLET_NOT_FOUND' | 'WALLET_ERROR' | 'PROOF_FAILED' | 'PROOF_INVALID_LOCAL' | 'WRONG_PASSWORD' | 'NO_CREDENTIAL' | 'SECRET_NOT_IN_TREE' | 'ARTIFACT_ERROR' | 'ARTIFACT_INTEGRITY_FAILED' | `CONTRACT_${number}` | 'UNKNOWN';
interface ParsedFluppyError {
    readonly code: FluppyErrorCode;
    readonly userMessage: string;
    readonly action: FluppyErrorAction | undefined;
}
/**
 * Base error class for all Fluppy SDK errors.
 */
declare class FluppyError extends Error {
    readonly code: FluppyErrorCode;
    readonly userMessage: string;
    readonly action: FluppyErrorAction | undefined;
    constructor(code: FluppyErrorCode, userMessage: string, action?: FluppyErrorAction, cause?: unknown);
    toJSON(): ParsedFluppyError;
}
/**
 * Error thrown during proof generation or proof verification.
 */
declare class FluppyProofError extends FluppyError {
    constructor(message: string, cause?: unknown);
}
/**
 * Error thrown when network requests fail.
 */
declare class FluppyNetworkError extends FluppyError {
    constructor(message: string, cause?: unknown);
}
/**
 * Error thrown during wallet interactions.
 */
declare class FluppyWalletError extends FluppyError {
    constructor(code: 'WALLET_NOT_FOUND' | 'USER_REJECTED' | 'WALLET_ERROR', userMessage: string, cause?: unknown);
}
/**
 * Error thrown when proof root and on-chain root do not match.
 */
declare class FluppyRootMismatchError extends FluppyError {
    readonly proofRoot: string;
    readonly contractRoot: string;
    constructor(proofRoot: string, contractRoot: string);
}
/**
 * Error thrown when circuit artifacts fail to load or verify.
 */
declare class FluppyArtifactError extends FluppyError {
    constructor(message: string, cause?: unknown);
}
/**
 * Error thrown when the Soroban contract returns a numeric error code.
 */
declare class FluppyContractError extends FluppyError {
    readonly contractCode: number;
    constructor(contractCode: number, userMessage: string, action?: FluppyErrorAction);
}
/**
 * Parses any thrown value into a structured FluppyError.
 */
declare function parseFluppyError(err: unknown): FluppyError;

/**
 * Converts a decimal string to a 32-byte big-endian hex string.
 *
 * Used to encode public signals into Soroban wire format:
 * BytesN<32>
 */
declare function decimalToBe32Hex(decimal: string): string;
/**
 * Encodes a BN254 G1 affine point into a 64-byte hex string.
 *
 * Layout:
 * x_be32 || y_be32
 *
 * Used for Groth16 pi_a and pi_c.
 */
declare function encodeG1(point: readonly [string, string, string]): string;
/**
 * Encodes a BN254 G2 affine point into a 128-byte hex string.
 *
 * Layout:
 * x_c1_be32 || x_c0_be32 || y_c1_be32 || y_c0_be32
 *
 * SnarkJS stores pi_b as:
 * [[x_c1, x_c0], [y_c1, y_c0], [1, 0]]
 *
 * The order is preserved because the Soroban contract expects
 * this exact wire format.
 */
declare function encodeG2(point: readonly [
    readonly [string, string],
    readonly [string, string],
    readonly [string, string]
]): string;
/**
 * Reduces a 64-character hex secret into a valid BN254 field element.
 *
 * Returns a decimal string because Circom inputs are passed as decimal strings.
 *
 * This must match the existing secretToBn254FieldElement() behavior in zkp.ts.
 */
declare function hexSecretToFieldElement(hexSecret: string): string;

/**
 * Shared Fluppy SDK types.
 *
 * These types are intentionally framework-agnostic:
 * - no React
 * - no Next.js
 * - no browser-only APIs
 */
/**
 * Groth16 proof in Soroban wire format.
 *
 * Encoding:
 * - pi_a: 128 hex chars = 64 bytes
 * - pi_b: 256 hex chars = 128 bytes
 * - pi_c: 128 hex chars = 64 bytes
 * - publicSignals: 7 × 64 hex chars
 */
interface PaymentProofOutput {
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
        string
    ];
}
/**
 * Merkle membership proof returned by the Merkle API.
 */
interface MerkleProof {
    readonly pathElements: readonly bigint[];
    readonly pathIndices: readonly number[];
    readonly root: bigint;
}
/**
 * Progress update emitted during proof generation.
 */
interface ProofProgress {
    readonly stage: string;
    readonly pct: number;
}
/**
 * Progress callback used by browser SDK proof generation.
 */
type ProgressCallback = (progress: ProofProgress) => void;
/**
 * Legacy progress callback shape used by the current app.
 *
 * Keep this for compatibility during migration.
 * Later, fluppy-browser can standardize on ProgressCallback.
 */
type LegacyProgressCallback = (stage: string, pct: number) => void;
type PaymentStatus = 'idle' | 'pending' | 'success' | 'failed';
interface PaymentResult {
    readonly txHash: string;
    readonly explorerUrl: string;
    readonly status: 'success';
}
interface FluppyCoreConfig {
    readonly contractId: string;
    readonly networkPassphrase: string;
    readonly rpcUrl: string;
}

/**
 * Computes a BN254-safe recipient hash from a Stellar address.
 *
 * Algorithm:
 * 1. Convert Stellar address to Soroban ScVal XDR.
 * 2. Hash the XDR bytes using SHA-256.
 * 3. Zero the most-significant byte to guarantee the result is < BN254_R.
 * 4. Return the value as a decimal string for Circom input.
 *
 * This must match compute_recipient_hash() in the Soroban contract.
 */
declare function computeRecipientHash(stellarAddress: string): string;

/**
 * Well-known Stellar network passphrases.
 */
declare const STELLAR_NETWORKS: {
    readonly TESTNET: Networks.TESTNET;
    readonly MAINNET: Networks.PUBLIC;
};
type StellarNetworkName = keyof typeof STELLAR_NETWORKS;
/**
 * Computes a BN254-safe chain identifier from a Stellar network passphrase.
 *
 * Algorithm:
 * 1. UTF-8 encode the network passphrase.
 * 2. Hash the bytes using SHA-256.
 * 3. Zero the most-significant byte to guarantee the result is < BN254_R.
 * 4. Return the value as a decimal string for Circom input.
 *
 * This must match compute_chain_id() in the Soroban contract.
 */
declare function computeChainId(networkPassphrase: string): string;

/**
 * @fluppy/core
 *
 * Protocol-level primitives for the Fluppy ZK Payment Protocol.
 */

declare const FLUPPY_CORE_VERSION = "0.1.0";

export { BN254_R, CIRCUIT_DEPTH, DEFAULT_MAX_AMOUNT, DEFAULT_MIN_AMOUNT, FLUPPY_CORE_VERSION, FluppyArtifactError, FluppyContractError, type FluppyCoreConfig, FluppyError, type FluppyErrorAction, type FluppyErrorCode, FluppyNetworkError, FluppyProofError, FluppyRootMismatchError, FluppyWalletError, type LegacyProgressCallback, type MerkleProof, N_PUBLIC, POSEIDON_TAGS, type ParsedFluppyError, type PaymentProofOutput, type PaymentResult, type PaymentStatus, type ProgressCallback, type ProofProgress, STELLAR_NETWORKS, type StellarNetworkName, USDC_DECIMALS, computeChainId, computeRecipientHash, decimalToBe32Hex, encodeG1, encodeG2, hexSecretToFieldElement, parseFluppyError, usdcToStroops };
