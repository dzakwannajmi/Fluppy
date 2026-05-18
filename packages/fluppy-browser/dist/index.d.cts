export * from '@fluppy/core';

/**
 * @fluppy/browser — Fluppy ZK Payment Protocol browser SDK.
 *
 * This package provides browser-side implementations for:
 * - Merkle proof client operations
 * - ZK circuit artifact loading
 * - Groth16 proof generation and local verification
 * - Browser credential management
 * - Stellar/Freighter wallet integration
 *
 * This package must not import React, Next.js, Sentry, or UI code.
 */

declare const FLUPPY_BROWSER_VERSION = "0.1.0";

export { FLUPPY_BROWSER_VERSION };
