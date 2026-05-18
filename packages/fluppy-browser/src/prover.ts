/// <reference path="./types/snarkjs.d.ts" />

/**
 * prover.ts — Groth16 ZK prover for the Fluppy browser SDK.
 *
 * Responsibilities:
 * - Build circuit inputs from payment parameters
 * - Generate a Groth16 proof via snarkjs.groth16.fullProve()
 * - Encode proof output into Soroban wire format
 * - Verify a proof locally via snarkjs.groth16.verify()
 * - Support progress callbacks and AbortSignal cancellation
 * - Prevent concurrent proof generation via a generation lock
 *
 * Security rules:
 * - Secret is never logged or transmitted
 * - Private inputs are never logged
 * - Proof encoding and public signal ordering must remain unchanged
 *
 * This module must not import React, Next.js, Sentry, or UI code.
 */

import * as snarkjs from 'snarkjs';

import {
  BN254_R,
  CIRCUIT_DEPTH,
  N_PUBLIC,
  decimalToBe32Hex,
  encodeG1,
  encodeG2,
  hexSecretToFieldElement,
  computeRecipientHash,
  computeChainId,
  type MerkleProof,
  type PaymentProofOutput,
} from '@fluppy/core';

import {
  loadCircuitArtifacts,
  loadVerificationKey,
  validateCircuitArtifacts,
} from './artifacts';

const MAX_PAYMENT_AMOUNT_STROOPS = BigInt(1000 * 10 ** 7);

export type ProofProgressCallback = (
  stage: string,
  pct: number,
) => void;

export interface GenerateZkProofInput {
  readonly secret: string;
  readonly merkleProof: MerkleProof;
  readonly recipient: string;
  readonly amount: bigint;
  readonly networkPassphrase: string;
  readonly onProgress?: ProofProgressCallback;
  readonly signal?: AbortSignal;
}

interface CircuitInputs {
  readonly secret: string;
  readonly nonce: string;
  readonly amount: string;
  readonly pathElements: string[];
  readonly pathIndices: number[];
  readonly merkleRoot: string;
  readonly recipientHash: string;
  readonly minAmount: string;
  readonly maxAmount: string;
  readonly chainId: string;
}

let activeGenerationId: string | null = null;

function createGenerationId(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(8),
  );

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function acquireGenerationLock(): string {
  if (activeGenerationId !== null) {
    throw new Error(
      '[prover] Another proof generation is already in progress',
    );
  }

  const generationId = createGenerationId();
  activeGenerationId = generationId;

  return generationId;
}

function releaseGenerationLock(
  generationId: string,
): void {
  if (activeGenerationId === generationId) {
    activeGenerationId = null;
  }
}

function throwIfAborted(
  signal?: AbortSignal,
): void {
  if (signal?.aborted) {
    throw new DOMException(
      'Proof generation was aborted',
      'AbortError',
    );
  }
}

function createProgressUpdater(
  callback?: ProofProgressCallback,
) {
  return {
    update(stage: string, pct: number): void {
      callback?.(stage, pct);
    },

    complete(): void {
      callback?.('Completed', 100);
    },
  };
}

function generateSecureNonce(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(32),
  );

  const hex = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  const raw = BigInt(`0x${hex}`);

  return (raw % BN254_R).toString();
}

function validateProofInputs(
  secret: string,
  pathElements: readonly bigint[],
  pathIndices: readonly number[],
): void {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      '[prover] Invalid secret format: must be 64-char hex string',
    );
  }

  if (pathElements.length !== CIRCUIT_DEPTH) {
    throw new Error(
      `[prover] pathElements length ${pathElements.length} !== CIRCUIT_DEPTH ${CIRCUIT_DEPTH}`,
    );
  }

  if (pathIndices.length !== CIRCUIT_DEPTH) {
    throw new Error(
      `[prover] pathIndices length ${pathIndices.length} !== CIRCUIT_DEPTH ${CIRCUIT_DEPTH}`,
    );
  }
}

function buildCircuitInputs(
  input: GenerateZkProofInput,
): CircuitInputs {
  const {
    secret,
    merkleProof,
    recipient,
    amount,
    networkPassphrase,
  } = input;

  const {
    pathElements,
    pathIndices,
    root,
  } = merkleProof;

  return {
    secret: hexSecretToFieldElement(secret),
    nonce: generateSecureNonce(),
    amount: amount.toString(),
    pathElements: pathElements.map(element => element.toString()),
    pathIndices: [...pathIndices],
    merkleRoot: root.toString(),
    recipientHash: computeRecipientHash(recipient),
    minAmount: '0',
    maxAmount: MAX_PAYMENT_AMOUNT_STROOPS.toString(),
    chainId: computeChainId(networkPassphrase),
  };
}

function validateRootConsistency(
  publicSignals: readonly string[],
): void {
  const verifiedRoot = BigInt(publicSignals[1] ?? '0');
  const providedRoot = BigInt(publicSignals[2] ?? '0');

  if (verifiedRoot !== providedRoot) {
    throw new Error(
      '[prover] Merkle root consistency check failed',
    );
  }
}

function encodeProofOutput(
  proof: {
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
  },
  publicSignals: string[],
): PaymentProofOutput {
  if (publicSignals.length !== N_PUBLIC) {
    throw new Error(
      `[prover] Public signal count mismatch: got ${publicSignals.length}, expected ${N_PUBLIC}`,
    );
  }

  const pi_a = encodeG1(proof.pi_a);
  const pi_b = encodeG2(proof.pi_b);
  const pi_c = encodeG1(proof.pi_c);

  const encodedSignals = publicSignals.map(
    signal => decimalToBe32Hex(signal),
  ) as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  return {
    pi_a,
    pi_b,
    pi_c,
    publicSignals: encodedSignals,
  };
}

function reconstructProofForVerification(
  proof: PaymentProofOutput,
) {
  return {
    pi_a: [
      BigInt(`0x${proof.pi_a.slice(0, 64)}`).toString(),
      BigInt(`0x${proof.pi_a.slice(64, 128)}`).toString(),
      '1',
    ],
    pi_b: [
      [
        BigInt(`0x${proof.pi_b.slice(0, 64)}`).toString(),
        BigInt(`0x${proof.pi_b.slice(64, 128)}`).toString(),
      ],
      [
        BigInt(`0x${proof.pi_b.slice(128, 192)}`).toString(),
        BigInt(`0x${proof.pi_b.slice(192, 256)}`).toString(),
      ],
      ['1', '0'],
    ],
    pi_c: [
      BigInt(`0x${proof.pi_c.slice(0, 64)}`).toString(),
      BigInt(`0x${proof.pi_c.slice(64, 128)}`).toString(),
      '1',
    ],
    protocol: 'groth16',
    curve: 'bn128',
  };
}

export async function generateZkProof(
  input: GenerateZkProofInput,
): Promise<PaymentProofOutput> {
  const {
    secret,
    merkleProof,
    signal,
    onProgress,
  } = input;

  const {
    pathElements,
    pathIndices,
  } = merkleProof;

  throwIfAborted(signal);

  const generationId = acquireGenerationLock();
  const progress = createProgressUpdater(onProgress);

  try {
    progress.update('Validating artifacts', 5);

    const artifactOptions = signal ? { signal } : {};

    await validateCircuitArtifacts(artifactOptions);

    throwIfAborted(signal);

    validateProofInputs(
      secret,
      pathElements,
      pathIndices,
    );

    progress.update('Preparing inputs', 15);

    const circuitInputs = buildCircuitInputs(input);

    throwIfAborted(signal);

    progress.update('Loading artifacts', 25);

    const { wasm, zkey } =
      await loadCircuitArtifacts(artifactOptions);

    throwIfAborted(signal);

    progress.update('Computing witness', 45);

    const proveResult =
      await snarkjs.groth16.fullProve(
        circuitInputs as unknown as Record<string, unknown>,
        wasm,
        zkey,
      );

    throwIfAborted(signal);

    progress.update('Encoding proof', 90);

    validateRootConsistency(
      proveResult.publicSignals,
    );

    const output = encodeProofOutput(
      proveResult.proof,
      proveResult.publicSignals,
    );

    progress.complete();

    console.info(
      `[prover] Proof generated: pi_a=${output.pi_a.length / 2}B ` +
      `pi_b=${output.pi_b.length / 2}B pi_c=${output.pi_c.length / 2}B`,
    );

    return output;
  } finally {
    releaseGenerationLock(generationId);
  }
}

export async function verifyProofLocally(
  proof: PaymentProofOutput,
): Promise<boolean> {
  try {
    const verificationKey = await loadVerificationKey();

    const reconstructed =
      reconstructProofForVerification(proof);

    const publicSignals =
      proof.publicSignals.map(signal =>
        BigInt(`0x${signal}`).toString(),
      );

    const isValid =
      await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        reconstructed,
      );

    console.info(
      `[prover] Local verification: ${isValid ? '✓ VALID' : '❌ INVALID'}`,
    );

    return isValid;
  } catch (err: unknown) {
    console.error(
      '[prover] Local verification error:',
      err,
    );

    return false;
  }
}
