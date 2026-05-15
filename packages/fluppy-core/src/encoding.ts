import { BN254_R } from './constants';

/**
 * Converts a decimal string to a 32-byte big-endian hex string.
 *
 * Used to encode public signals into Soroban wire format:
 * BytesN<32>
 */
export function decimalToBe32Hex(decimal: string): string {
  const value = BigInt(decimal);

  if (value < 0n || value >= 2n ** 256n) {
    throw new RangeError(`Field element out of range: ${decimal}`);
  }

  return value.toString(16).padStart(64, '0');
}

/**
 * Encodes a BN254 G1 affine point into a 64-byte hex string.
 *
 * Layout:
 * x_be32 || y_be32
 *
 * Used for Groth16 pi_a and pi_c.
 */
export function encodeG1(
  point: readonly [string, string, string],
): string {
  const [x, y] = point;

  return decimalToBe32Hex(x) + decimalToBe32Hex(y);
}

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
export function encodeG2(
  point: readonly [
    readonly [string, string],
    readonly [string, string],
    readonly [string, string],
  ],
): string {
  const [x, y] = point;

  return (
    decimalToBe32Hex(x[0]) +
    decimalToBe32Hex(x[1]) +
    decimalToBe32Hex(y[0]) +
    decimalToBe32Hex(y[1])
  );
}

/**
 * Reduces a 64-character hex secret into a valid BN254 field element.
 *
 * Returns a decimal string because Circom inputs are passed as decimal strings.
 *
 * This must match the existing secretToBn254FieldElement() behavior in zkp.ts.
 */
export function hexSecretToFieldElement(hexSecret: string): string {
  if (!/^[0-9a-f]{64}$/i.test(hexSecret)) {
    throw new TypeError(
      'Invalid secret format: must be a 64-character hex string',
    );
  }

  const raw = BigInt(`0x${hexSecret}`);
  const reduced = raw % BN254_R;

  return reduced.toString();
}
