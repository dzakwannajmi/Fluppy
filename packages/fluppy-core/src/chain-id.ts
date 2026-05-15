import { hash, Networks } from '@stellar/stellar-sdk';

/**
 * Well-known Stellar network passphrases.
 */
export const STELLAR_NETWORKS = {
  TESTNET: Networks.TESTNET,
  MAINNET: Networks.PUBLIC,
} as const;

export type StellarNetworkName =
  keyof typeof STELLAR_NETWORKS;

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
export function computeChainId(networkPassphrase: string): string {
  if (networkPassphrase.trim() === '') {
    throw new TypeError('Network passphrase cannot be empty');
  }

  const passphraseBytes = Buffer.from(networkPassphrase, 'utf8');
  const hashed = hash(passphraseBytes);

  hashed[0] = 0;

  return BigInt(`0x${hashed.toString('hex')}`).toString();
}
