declare module 'circomlibjs' {
  export interface PoseidonField {
    toObject(value: unknown): bigint;
  }

  export interface PoseidonHasher {
    (inputs: readonly (bigint | number | string)[]): unknown;
    F: PoseidonField;
  }

  export function buildPoseidon(): Promise<PoseidonHasher>;
}
