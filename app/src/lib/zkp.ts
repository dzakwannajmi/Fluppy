import * as snarkjs from "snarkjs";

// ============================================================================
// Interfaces
// ============================================================================

export interface CircuitInputs {
  // Private Inputs
  secret: bigint | string;
  nonce: bigint | string;
  amount: bigint | string;
  pathElements: (bigint | string)[];
  pathIndices: (number | string)[];

  // Public Inputs
  merkleRoot: bigint | string;
  recipientHash: bigint | string;
  minAmount: bigint | string;
  maxAmount: bigint | string;
}

export interface FluppyProof {
  pi_a: string;         // 64 hex chars (32 bytes X || 32 bytes Y)
  pi_b: string;         // 128 hex chars (x.c1 || x.c0 || y.c1 || y.c0)
  pi_c: string;         // 64 hex chars (32 bytes X || 32 bytes Y)
  publicSignals: string[]; // [nullifier, verifiedRoot, merkleRoot, recipientHash, minAmount, maxAmount]
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalizes a SnarkJS decimal string output into a 32-byte zero-padded hex string.
 * This is crucial for matching the Soroban BytesN<32> / BytesN<64> formatting.
 */
const toHex32 = (decStr: string | number | bigint): string => {
  return BigInt(decStr).toString(16).padStart(64, "0");
};

// ============================================================================
// Main Prover Logic
// ============================================================================

/**
 * Generates a Groth16 proof using SnarkJS and formats the raw outputs
 * for direct on-chain verification in Soroban (Protocol 25 BN254).
 */
export async function generatePaymentProof(
  inputs: CircuitInputs,
  wasmPath: string = "/circuit.wasm",
  zkeyPath: string = "/circuit_final.zkey"
): Promise<FluppyProof> {
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      wasmPath,
      zkeyPath
    );

    // 1. Format pi_a (G1 Point) -> Drop the '1' at index 2
    const pi_a = toHex32(proof.pi_a[0]) + toHex32(proof.pi_a[1]);

    // 2. Format pi_b (G2 Point) -> Map SnarkJS [[c1, c0], [c1, c0]] to flat hex
    // Source: verify.rs VerificationKey G2 format mapping
    const pi_b =
      toHex32(proof.pi_b[0][0]) + // X coordinate: c1
      toHex32(proof.pi_b[0][1]) + // X coordinate: c0
      toHex32(proof.pi_b[1][0]) + // Y coordinate: c1
      toHex32(proof.pi_b[1][1]);  // Y coordinate: c0

    // 3. Format pi_c (G1 Point) -> Drop the '1' at index 2
    const pi_c = toHex32(proof.pi_c[0]) + toHex32(proof.pi_c[1]);

    // 4. Normalize Public Signals (Outputs + Inputs)
    // Circuit Order: [nullifier, verifiedRoot, merkleRoot, recipientHash, minAmount, maxAmount]
    const formattedSignals = publicSignals.map((sig: string | number | bigint) =>
      toHex32(sig)
    );

    return {
      pi_a,
      pi_b,
      pi_c,
      publicSignals: formattedSignals,
    };

  } catch (error) {
    console.error("[Fluppy ZKP] Proof Generation Failed:", error);
    throw new Error("Failed to generate Groth16 proof. Verify input bounds and formats.");
  }
}