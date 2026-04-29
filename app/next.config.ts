import type { NextConfig } from "next";

const nextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      ],
    },
  ],
  outputFileTracingIncludes: {
    "/api/**/*": ["./public/circuit/**/*"],
  },
  serverExternalPackages: ["snarkjs"],
} satisfies NextConfig;

export default nextConfig;