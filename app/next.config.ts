import type { NextConfig } from "next";

const nextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        {
          key: "Content-Security-Policy",
          value: "script-src 'self' 'unsafe-eval' 'unsafe-inline';"
        },
      ],
    },
  ],
};

export default nextConfig;
