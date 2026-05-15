import { withSentryConfig } from '@sentry/nextjs';

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

  transpilePackages: ["@noble/hashes"],

  outputFileTracingIncludes: {
    "/api/**/*": ["./public/circuit/**/*"],
  },

  serverExternalPackages: ["snarkjs"],

  turbopack: {},

};  

export default withSentryConfig(nextConfig, {
  silent: true,

  disableLogger: true,

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: false,

  sourcemaps: {
    disable: true,
  },
});