/**
 * lib/zkp.ts — Fluppy ZKP Proof Generator
 *
 * Generates a Groth16 proof (Circom 2.1.x / BN254) whose output encoding
 * is EXACTLY compatible with the `verify_groth16_proof` function in
 * verify.rs (Soroban BytesN).
 *
 * Public signal ordering (MUST match verify.rs N_PUBLIC ordering):
 *   index 0 — nullifier        (circuit output)
 *   index 1 — verifiedRoot     (circuit output)
 *   index 2 — merkleRoot       (public input)
 *   index 3 — recipientHash    (public input)
 *   index 4 — minAmount        (public input)
 *   index 5 — maxAmount        (public input)
 *
 * Encoding conventions (match verify.rs § 2 / CAP-0074):
 *   Scalar  → 32-byte big-endian hex (64 hex chars)
 *   G1 point → x_be32 || y_be32     → 64-byte hex (128 hex chars)
 *   G2 point → x.c1_be32 || x.c0_be32 || y.c1_be32 || y.c0_be32
 *              → 128-byte hex (256 hex chars)
 *
 * SnarkJS G2 JSON layout  →  on-chain layout:
 *   proof.pi_b = [[x.c1, x.c0], [y.c1, y.c0], ["1","0"]]
 *   on-chain   = [x.c1_be32 || x.c0_be32 || y.c1_be32 || y.c0_be32]
 *   (the last ["1","0"] Z-coordinate is dropped — affine representation)
 */

import * as snarkjs from "snarkjs";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw witness inputs to the FluppyPayment(20) Circom circuit. */
export interface PaymentProofInputs {
  /** Random 32-byte secret chosen by the payer at deposit time (bigint). */
  secret: bigint;
  /** Per-transaction uniqueness salt (bigint). */
  nonce: bigint;
  /** Payment amount in stroops (bigint). */
  amount: bigint;
  /** Merkle sibling hashes along the path to the leaf (array of 20 bigints). */
  pathElements: bigint[];
  /** 0 = current node is left child, 1 = right child (array of 20 bigints). */
  pathIndices: number[];
  /** Current Merkle tree root (bigint). */
  merkleRoot: bigint;
  /** Poseidon2(recipientAddress) (bigint). */
  recipientHash: bigint;
  /** Lower bound for circuit amount check (bigint, in stroops). */
  minAmount: bigint;
  /** Upper bound for circuit amount check (bigint, in stroops). */
  maxAmount: bigint;
}

/**
 * Proof output fully compatible with verify.rs `verify_groth16_proof`.
 * All hex strings are lowercase, no "0x" prefix.
 */
export interface PaymentProofOutput {
  /** πA — G1 point — 128 hex chars (64 bytes). */
  pi_a: string;
  /** πB — G2 point — 256 hex chars (128 bytes). */
  pi_b: string;
  /** πC — G1 point — 128 hex chars (64 bytes). */
  pi_c: string;
  /**
   * Public signals in verify.rs index order:
   *   [nullifier, verifiedRoot, merkleRoot, recipientHash, minAmount, maxAmount]
   * Each element: 64 hex chars (32 bytes, big-endian).
   */
  publicSignals: [string, string, string, string, string, string];
}

// ─── Internal encoding helpers ────────────────────────────────────────────────

/** Expected number of public signals for FluppyPayment(20). */
const N_PUBLIC = 6 as const;

/** BN254 scalar field order r (for input validation). */
const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Converts a decimal string (from SnarkJS) to a zero-padded 32-byte
 * big-endian hex string (64 hex chars, no "0x").
 *
 * Throws if the value is not a valid non-negative integer string or
 * if the value exceeds 32 bytes (would indicate a corrupted proof element).
 */
function decimalToBe32Hex(decimal: string): string {
  const n = BigInt(decimal);

  if (n < 0n) {
    throw new RangeError(
      `Proof element is negative (${decimal}). BN254 field elements are non-negative.`
    );
  }
  if (n >= 2n ** 256n) {
    throw new RangeError(
      `Proof element exceeds 256 bits (${decimal}). Cannot fit in 32 bytes.`
    );
  }

  return n.toString(16).padStart(64, "0");
}

/**
 * Validates that a public signal is a valid BN254 scalar field element
 * (strictly less than r). Matches validate_public_inputs() in verify.rs.
 */
function assertInScalarField(decimal: string, label: string): void {
  const n = BigInt(decimal);
  if (n >= BN254_R) {
    throw new RangeError(
      `Public signal "${label}" (${decimal}) is ≥ BN254 scalar field order r. ` +
        `This would be rejected by validate_public_inputs() in verify.rs.`
    );
  }
}

/**
 * Encodes a SnarkJS G1 point ([x_dec, y_dec, "1"]) to a 64-byte
 * big-endian hex string:  x_be32 || y_be32
 *
 * The third element ("1") is the homogeneous Z coordinate in projective
 * form and is dropped — affine representation is used on-chain.
 */
function encodeG1(point: [string, string, string]): string {
  const x = decimalToBe32Hex(point[0]);
  const y = decimalToBe32Hex(point[1]);
  // Z (point[2]) == "1" always for affine — we assert and discard.
  if (point[2] !== "1") {
    throw new Error(
      `G1 point is not in affine form (Z = "${point[2]}", expected "1"). ` +
        `SnarkJS returned a non-normalised point.`
    );
  }
  const encoded = x + y;
  // Sanity: must be exactly 128 hex chars = 64 bytes.
  if (encoded.length !== 128) {
    throw new Error(`G1 encoding produced ${encoded.length} hex chars, expected 128.`);
  }
  return encoded;
}

/**
 * Encodes a SnarkJS G2 point to a 128-byte big-endian hex string:
 *   x.c1_be32 || x.c0_be32 || y.c1_be32 || y.c0_be32
 *
 * SnarkJS G2 JSON structure:
 *   [[x.c1, x.c0], [y.c1, y.c0], ["1", "0"]]
 *
 * The LAST tuple ["1","0"] is the Z coordinate and is dropped.
 * The c1/c0 swap is intentional — it matches the BN254 Fp2 encoding
 * used by the Soroban BN254 host functions (CAP-0074).
 */
function encodeG2(
  point: [[string, string], [string, string], [string, string]]
): string {
  const [[xc1, xc0], [yc1, yc0], [zc1, zc0]] = point;

  // Assert affine (Z must be the identity element for Fp2: (1, 0)).
  if (zc1 !== "1" || zc0 !== "0") {
    throw new Error(
      `G2 point is not in affine form (Z = ["${zc1}","${zc0}"], expected ["1","0"]).`
    );
  }

  const encoded =
    decimalToBe32Hex(xc1) +
    decimalToBe32Hex(xc0) +
    decimalToBe32Hex(yc1) +
    decimalToBe32Hex(yc0);

  // Sanity: must be exactly 256 hex chars = 128 bytes.
  if (encoded.length !== 256) {
    throw new Error(`G2 encoding produced ${encoded.length} hex chars, expected 256.`);
  }
  return encoded;
}

/**
 * Re-orders SnarkJS public signals into verify.rs index ordering and
 * validates that each is a valid BN254 scalar field element.
 *
 * SnarkJS outputs signals in Circom compilation order:
 *   outputs first, then declared public inputs.
 *
 * For FluppyPayment(20) this is:
 *   snarkjs[0] = nullifier       → output index 0
 *   snarkjs[1] = verifiedRoot    → output index 1
 *   snarkjs[2] = merkleRoot      → input  index 2
 *   snarkjs[3] = recipientHash   → input  index 3
 *   snarkjs[4] = minAmount       → input  index 4
 *   snarkjs[5] = maxAmount       → input  index 5
 *
 * This ordering is identical to verify.rs `public_inputs` array — no
 * reordering is needed, but we validate count and field membership here.
 */
function encodePublicSignals(
  signals: string[]
): [string, string, string, string, string, string] {
  if (signals.length !== N_PUBLIC) {
    throw new Error(
      `Expected ${N_PUBLIC} public signals, got ${signals.length}. ` +
        `Ensure circuit is FluppyPayment(20) with exactly 6 public signals.`
    );
  }

  const labels = [
    "nullifier",
    "verifiedRoot",
    "merkleRoot",
    "recipientHash",
    "minAmount",
    "maxAmount",
  ] as const;

  return signals.map((sig, i) => {
    assertInScalarField(sig, labels[i]);
    return decimalToBe32Hex(sig);
  }) as [string, string, string, string, string, string];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a Groth16 proof for the FluppyPayment(20) Circom circuit.
 *
 * All heavy computation runs off-chain in the browser or Node.js worker.
 * The returned bytes map directly to the BytesN parameters of
 * `verify_groth16_proof` in verify.rs — no further transformation needed.
 *
 * @param inputs     - Private witness + public inputs for the circuit.
 * @param wasmPath   - Path/URL to the compiled circuit WASM artifact.
 * @param zkeyPath   - Path/URL to the final proving key (circuit_final.zkey).
 * @returns          - Encoded proof and ordered public signals.
 *
 * @throws {RangeError}  If any public signal is outside the BN254 scalar field.
 * @throws {Error}       If SnarkJS proof generation fails or encoding is invalid.
 *
 * @example
 * ```ts
 * const proof = await generatePaymentProof(
 *   inputs,
 *   "/circuit/fluppy_payment.wasm",
 *   "/circuit/circuit_final.zkey"
 * );
 * // Submit to Soroban via contract client:
 * // verifyContract.verify_groth16_proof({
 * //   pi_a:           Buffer.from(proof.pi_a, "hex"),
 * //   pi_b:           Buffer.from(proof.pi_b, "hex"),
 * //   pi_c:           Buffer.from(proof.pi_c, "hex"),
 * //   nullifier:      Buffer.from(proof.publicSignals[0], "hex"),
 * //   verified_root:  Buffer.from(proof.publicSignals[1], "hex"),
 * //   merkle_root:    Buffer.from(proof.publicSignals[2], "hex"),
 * //   recipient_hash: Buffer.from(proof.publicSignals[3], "hex"),
 * //   min_amount:     Buffer.from(proof.publicSignals[4], "hex"),
 * //   max_amount:     Buffer.from(proof.publicSignals[5], "hex"),
 * // });
 * ```
 */
export async function generatePaymentProof(
  inputs: PaymentProofInputs,
  wasmPath: string,
  zkeyPath: string
): Promise<PaymentProofOutput> {
  // ── 1. Build the circuit witness object ────────────────────────────────────
  //
  // Keys must match signal names declared in FluppyPayment.circom exactly.
  // All values must be strings or arrays of strings (SnarkJS requirement).
  const circuitInputs: Record<string, string | string[] | number[]> = {
    secret:        inputs.secret.toString(),
    nonce:         inputs.nonce.toString(),
    amount:        inputs.amount.toString(),
    pathElements:  inputs.pathElements.map(String),
    pathIndices:   inputs.pathIndices,
    merkleRoot:    inputs.merkleRoot.toString(),
    recipientHash: inputs.recipientHash.toString(),
    minAmount:     inputs.minAmount.toString(),
    maxAmount:     inputs.maxAmount.toString(),
  };

  // ── 2. Generate Groth16 proof via SnarkJS ──────────────────────────────────
  //
  // fullProve = witness generation + prove in one call.
  // Returns: { proof, publicSignals }
  //   proof.pi_a  = [x_dec, y_dec, "1"]
  //   proof.pi_b  = [[xc1, xc0], [yc1, yc0], ["1","0"]]
  //   proof.pi_c  = [x_dec, y_dec, "1"]
  //   publicSignals = string[] in Circom signal order
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInputs,
    wasmPath,
    zkeyPath
  );

  // ── 3. Encode proof elements to Soroban-compatible byte strings ────────────

  const pi_a = encodeG1(
    proof.pi_a as [string, string, string]
  );

  const pi_b = encodeG2(
    proof.pi_b as [[string, string], [string, string], [string, string]]
  );

  const pi_c = encodeG1(
    proof.pi_c as [string, string, string]
  );

  // ── 4. Encode and validate public signals ──────────────────────────────────
  //
  // Order is set by the Circom compiler (outputs before declared inputs).
  // This matches verify.rs `public_inputs` array index-for-index.
  const encodedSignals = encodePublicSignals(publicSignals as string[]);

  return { pi_a, pi_b, pi_c, publicSignals: encodedSignals };
}