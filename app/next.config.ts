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

  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./public/circuit/**/*'],
    },
    serverComponentsExternalPackages: ['snarkjs'],
  },

};

export default nextConfig;
