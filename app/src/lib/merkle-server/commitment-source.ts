import type { CommitmentSource } from './types';

/**
 * In-memory commitment source for local/testnet development.
 *
 * The backend stores only commitments. Raw secrets never leave the browser.
 */
export class InMemoryCommitmentSource implements CommitmentSource {
  private readonly commitments: bigint[] = [];
  private readonly commitmentKeys = new Set<string>();

  async getAllCommitments(): Promise<bigint[]> {
    return [...this.commitments];
  }

  add(commitment: bigint): boolean {
    const key = this.toKey(commitment);

    if (this.commitmentKeys.has(key)) {
      return false;
    }

    this.commitments.push(commitment);
    this.commitmentKeys.add(key);

    return true;
  }

  has(commitment: bigint): boolean {
    return this.commitmentKeys.has(
      this.toKey(commitment),
    );
  }

  size(): number {
    return this.commitments.length;
  }

  private toKey(commitment: bigint): string {
    return commitment
      .toString(16)
      .padStart(64, '0')
      .toLowerCase();
  }
}

let sourceInstance: InMemoryCommitmentSource | null = null;

export function getCommitmentSource(): InMemoryCommitmentSource {
  if (!sourceInstance) {
    sourceInstance = new InMemoryCommitmentSource();
  }

  return sourceInstance;
}
