import type { CommitmentSource } from './types';

/**
 * In-memory commitment source for Phase 3A.
 * Replace with PostgresCommitmentSource in Phase 3B/4.
 *
 * Each merchant enrollment is represented as a commitment = Poseidon(LEAF_TAG, secret).
 * The raw secret is NEVER stored — only the hashed commitment.
 */
export class InMemoryCommitmentSource implements CommitmentSource {
  private commitments: bigint[] = [];

  async getAllCommitments(): Promise<bigint[]> {
    return [...this.commitments];
  }

  /**
   * Register a new commitment (admin operation).
   * In production, this is replaced by an authenticated admin endpoint.
   */
  add(commitment: bigint): void {
    if (!this.commitments.includes(commitment)) {
      this.commitments.push(commitment);
    }
  }

  size(): number {
    return this.commitments.length;
  }
}

// Module-level singleton — survives across API requests within the same process
let _instance: InMemoryCommitmentSource | null = null;

export function getCommitmentSource(): InMemoryCommitmentSource {
  if (!_instance) _instance = new InMemoryCommitmentSource();
  return _instance;
}