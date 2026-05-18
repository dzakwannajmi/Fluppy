'use client';

import * as snarkjs from 'snarkjs';
import { Address, Networks, hash } from '@stellar/stellar-sdk';
import type { MerkleProof } from './merkle';

import {
  BN254_R,
  CIRCUIT_DEPTH,
  N_PUBLIC,
  decimalToBe32Hex,
  encodeG1,
  encodeG2,
  hexSecretToFieldElement,
} from '@fluppy/core';

import {
  loadCircuitArtifacts,
  loadVerificationKey,
  validateCircuitArtifacts,
} from '@fluppy/browser';


// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ProofProgress {
  stage: string;
  pct: number;
}

export type ProofProgressCallback = (
  stage: string,
  pct: number,
) => void;

export interface GenerateProofOptions {
  signal?: AbortSignal;
  onProgress?: ProofProgressCallback;
}

export interface PaymentProofOutput {
  pi_a: string;
  pi_b: string;
  pi_c: string;

  publicSignals: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
}


interface Groth16ProofResult {
  proof: {
    pi_a: [string, string, string];

    pi_b: [
      [string, string],
      [string, string],
      [string, string],
    ];

    pi_c: [string, string, string];

    protocol: string;
    curve: string;
  };

  publicSignals: string[];
}

// ─────────────────────────────────────────────────────────────
// GENERATION LOCK
// ─────────────────────────────────────────────────────────────

let activeGenerationId:
  string | null = null;

function createGenerationId(): string {
  const bytes =
    crypto.getRandomValues(
      new Uint8Array(8),
    );

  return Array.from(bytes)
    .map(b =>
      b.toString(16).padStart(2, '0'),
    )
    .join('');
}

function acquireGenerationLock(): string {
  if (activeGenerationId) {
    throw new Error(
      '[ZKP] Another proof generation is already active',
    );
  }

  const id = createGenerationId();

  activeGenerationId = id;

  return id;
}

function releaseGenerationLock(
  generationId: string,
): void {
  if (
    activeGenerationId === generationId
  ) {
    activeGenerationId = null;
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function throwIfAborted(
  signal?: AbortSignal,
): void {
  if (signal?.aborted) {
    throw new DOMException(
      'Proof generation aborted',
      'AbortError',
    );
  }
}

function createProgressUpdater(
  callback?: ProofProgressCallback,
) {
  return {
    update(
      stage: string,
      pct: number,
    ): void {
      callback?.(stage, pct);
    },

    complete(): void {
      callback?.(
        'Completed',
        100,
      );
    },
  };
}

function validateMerkleRoot(
  verifiedRoot: bigint,
  providedRoot: bigint,
): void {
  if (verifiedRoot !== providedRoot) {
    throw new Error(
      '[ZKP] Root consistency validation failed',
    );
  }
}

// ─────────────────────────────────────────────────────────────
// FIELD HELPERS
// ─────────────────────────────────────────────────────────────
function generateSecureNonce(): string {
  const bytes =
    crypto.getRandomValues(
      new Uint8Array(32),
    );

  const hex =
    Array.from(bytes)
      .map(b =>
        b.toString(16).padStart(2, '0'),
      )
      .join('');

  const raw =
    BigInt(`0x${hex}`);

  return (
    raw % BN254_R
  ).toString();
}

export function computeRecipientHash(
  addressStr: string,
): string {
  const addr =
    Address.fromString(addressStr);

  const xdrBytes =
    addr.toScVal().toXDR();

  const hashed =
    hash(xdrBytes);

  hashed[0] = 0;

  return BigInt(
    `0x${hashed.toString('hex')}`,
  ).toString();
}

export function computeChainId(
  networkPassphrase: string,
): string {
  const bytes =
    new TextEncoder().encode(
      networkPassphrase,
    );

  function toBuffer(data: Uint8Array): Buffer {
    return Buffer.from(data);
  }

  const hashed = hash(toBuffer(bytes));

  hashed[0] = 0;

  return BigInt(
    `0x${hashed.toString('hex')}`,
  ).toString();
}

// ─────────────────────────────────────────────────────────────
// MAIN API
// ─────────────────────────────────────────────────────────────

export async function generateZkProof(
  secret: string,
  merkleProof: MerkleProof,
  recipient: string,
  amount: bigint,
  onProgress?: ProofProgressCallback,
  abortSignal?: AbortSignal,
): Promise<PaymentProofOutput> {
  if (
    typeof window === 'undefined'
  ) {
    throw new Error(
      '[ZKP] Client-side only',
    );
  }

  const signal =
    abortSignal ?? new AbortController().signal;

  throwIfAborted(signal);

  const generationId =
    acquireGenerationLock();

  const progress =
    createProgressUpdater(
      onProgress,
    );

  try {
    progress.update(
      'Validating artifacts',
      5,
    );

    await validateCircuitArtifacts({ signal });

    throwIfAborted(signal);

    if (
      !/^[0-9a-f]{64}$/i.test(
        secret,
      )
    ) {
      throw new Error(
        '[ZKP] Invalid secret format',
      );
    }

    const {
      pathElements,
      pathIndices,
      root,
    } = merkleProof;

    if (
      pathElements.length !==
      CIRCUIT_DEPTH
    ) {
      throw new Error(
        '[ZKP] Invalid pathElements depth',
      );
    }

    if (
      pathIndices.length !==
      CIRCUIT_DEPTH
    ) {
      throw new Error(
        '[ZKP] Invalid pathIndices depth',
      );
    }

    progress.update(
      'Preparing inputs',
      15,
    );

    const networkPassphrase =
      process.env
        .NEXT_PUBLIC_NETWORK_PASSPHRASE;

    if (!networkPassphrase) {
      throw new Error(
        '[ZKP] NEXT_PUBLIC_NETWORK_PASSPHRASE missing',
      );
    }

    const recipientHash =
      computeRecipientHash(
        recipient,
      );

    const chainId =
      computeChainId(
        networkPassphrase,
      );

    const circuitInputs = {
      secret:
        hexSecretToFieldElement(
          secret,
        ),

      nonce:
        generateSecureNonce(),

      amount:
        amount.toString(),

      pathElements:
        pathElements.map(e =>
          e.toString(),
        ),

      pathIndices,

      merkleRoot:
        root.toString(),

      recipientHash,

      minAmount: '0',

      maxAmount:
        BigInt(
          1000 * 10 ** 7,
        ).toString(),

      chainId,
    };

    progress.update(
      'Loading artifacts',
      25,
    );

    const {
      wasm,
      zkey,
    } = await loadCircuitArtifacts({
      signal,
    });

    throwIfAborted(signal);

    progress.update(
      'Computing witness',
      45,
    );

    const proveResult =
      await snarkjs.groth16
        .fullProve(
          circuitInputs,
          wasm,
          zkey,
        ) as Groth16ProofResult;

    throwIfAborted(signal);

    progress.update(
      'Encoding proof',
      90,
    );

    const {
      proof,
      publicSignals,
    } = proveResult;

    if (
      publicSignals.length !==
      N_PUBLIC
    ) {
      throw new Error(
        '[ZKP] Public signal mismatch',
      );
    }

    const verifiedRoot =
      BigInt(publicSignals[1]);

    const providedRoot =
      BigInt(publicSignals[2]);

    validateMerkleRoot(
      verifiedRoot,
      providedRoot,
    );

    const pi_a =
      encodeG1(
        proof.pi_a,
      );

    const pi_b =
      encodeG2(
        proof.pi_b,
      );

    const pi_c =
      encodeG1(
        proof.pi_c,
      );

    const encodedSignals =
      publicSignals.map(
        (sig: string) =>
          decimalToBe32Hex(sig),
      ) as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];

    progress.complete();

    return {
      pi_a,
      pi_b,
      pi_c,
      publicSignals:
        encodedSignals,
    };

  } finally {
    releaseGenerationLock(
      generationId,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// LOCAL VERIFICATION
// ─────────────────────────────────────────────────────────────

export async function verifyProofLocally(
  proof: PaymentProofOutput,
): Promise<boolean> {
  try {
    const vKey =
      await loadVerificationKey();

    const reconstructed = {
      pi_a: [
        BigInt(
          '0x' +
          proof.pi_a.slice(0, 64),
        ).toString(),

        BigInt(
          '0x' +
          proof.pi_a.slice(64, 128),
        ).toString(),

        '1',
      ],

      pi_b: [
        [
          BigInt(
            '0x' +
            proof.pi_b.slice(0, 64),
          ).toString(),

          BigInt(
            '0x' +
            proof.pi_b.slice(64, 128),
          ).toString(),
        ],

        [
          BigInt(
            '0x' +
            proof.pi_b.slice(128, 192),
          ).toString(),

          BigInt(
            '0x' +
            proof.pi_b.slice(192, 256),
          ).toString(),
        ],

        ['1', '0'],
      ],

      pi_c: [
        BigInt(
          '0x' +
          proof.pi_c.slice(0, 64),
        ).toString(),

        BigInt(
          '0x' +
          proof.pi_c.slice(64, 128),
        ).toString(),

        '1',
      ],

      protocol: 'groth16',
      curve: 'bn128',
    };

    const publicSignals =
      proof.publicSignals.map(
        sig =>
          BigInt(
            `0x${sig}`,
          ).toString(),
      );

    return await snarkjs
      .groth16
      .verify(
        vKey,
        publicSignals,
        reconstructed,
      );

  } catch (err) {
    console.error(
      '[ZKP] Local verification error:',
      err,
    );

    return false;
  }
}