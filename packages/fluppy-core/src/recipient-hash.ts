import { Address, hash } from '@stellar/stellar-sdk';

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
export function computeRecipientHash(stellarAddress: string): string {
  const address = Address.fromString(stellarAddress);
  const xdrBytes = address.toScVal().toXDR();
  const hashed = hash(xdrBytes);

  hashed[0] = 0;

  return BigInt(`0x${hashed.toString('hex')}`).toString();
}
