declare module 'snarkjs' {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmBuffer: Uint8Array,
      zkeyBuffer: Uint8Array,
    ): Promise<{
      proof: {
        pi_a: [string, string, string];
        pi_b: [[string, string], [string, string], [string, string]];
        pi_c: [string, string, string];
        protocol: string;
        curve: string;
      };
      publicSignals: string[];
    }>;

    verify(
      vk: unknown,
      publicSignals: string[],
      proof: {
        pi_a: unknown;
        pi_b: unknown;
        pi_c: unknown;
        protocol: string;
        curve: string;
      },
    ): Promise<boolean>;
  };
}
