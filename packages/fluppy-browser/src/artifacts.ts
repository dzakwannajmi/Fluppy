/**
 * artifacts.ts — Circuit artifact loader for Fluppy browser SDK.
 *
 * Responsibilities:
 * - Define default artifact paths
 * - Fetch and cache WASM and ZKey as Uint8Array
 * - Fetch and cache verification_key.json
 * - Validate artifact availability
 * - Expose cache reset for testing and development
 *
 * This module must not import React, Next.js, Sentry, or UI code.
 */

const CIRCUIT_VERSION = 'v3' as const;
const BASE_PATH = `/circuit/${CIRCUIT_VERSION}`;

const DEFAULT_PATHS: CircuitArtifactPaths = {
  wasmPath: `${BASE_PATH}/fluppy_payment.wasm`,
  zkeyPath: `${BASE_PATH}/circuit_final.zkey`,
  verificationKeyPath: `${BASE_PATH}/verification_key.json`,
};

export interface CircuitArtifactPaths {
  readonly wasmPath: string;
  readonly zkeyPath: string;
  readonly verificationKeyPath: string;
}

export interface CircuitArtifacts {
  readonly wasm: Uint8Array;
  readonly zkey: Uint8Array;
}

export interface LoadArtifactOptions {
  readonly paths?: Partial<CircuitArtifactPaths>;
  readonly cache?: RequestCache;
  readonly signal?: AbortSignal;
}

interface ArtifactCacheEntry {
  readonly wasm: Uint8Array;
  readonly zkey: Uint8Array;
  readonly version: string;
  readonly loadedAt: number;
}

let artifactCache: ArtifactCacheEntry | null = null;
let verificationKeyCache: unknown = null;

function resolvePaths(
  overrides?: Partial<CircuitArtifactPaths>,
): CircuitArtifactPaths {
  return {
    wasmPath: overrides?.wasmPath ?? DEFAULT_PATHS.wasmPath,
    zkeyPath: overrides?.zkeyPath ?? DEFAULT_PATHS.zkeyPath,
    verificationKeyPath:
      overrides?.verificationKeyPath ?? DEFAULT_PATHS.verificationKeyPath,
  };
}

function createFetchInit(
  options: LoadArtifactOptions,
  method: 'GET' | 'HEAD' = 'GET',
): RequestInit {
  const init: RequestInit = {
    method,
    cache: options.cache ?? 'no-store',
  };

  if (options.signal) {
    init.signal = options.signal;
  }

  return init;
}

async function fetchBinaryArtifact(
  path: string,
  options: LoadArtifactOptions,
): Promise<Uint8Array> {
  const response = await fetch(path, createFetchInit(options, 'GET'));

  if (!response.ok) {
    throw new Error(
      `[artifacts] Failed to load artifact: ${path} (HTTP ${response.status})`,
    );
  }

  const buffer = await response.arrayBuffer();

  return new Uint8Array(buffer);
}

async function fetchJsonArtifact(
  path: string,
  options: LoadArtifactOptions,
): Promise<unknown> {
  const response = await fetch(path, createFetchInit(options, 'GET'));

  if (!response.ok) {
    throw new Error(
      `[artifacts] Failed to load JSON artifact: ${path} (HTTP ${response.status})`,
    );
  }

  return await response.json();
}

async function checkArtifactExists(
  path: string,
  options: LoadArtifactOptions,
): Promise<void> {
  const headResponse = await fetch(
    path,
    createFetchInit(options, 'HEAD'),
  ).catch(() => null);

  if (headResponse?.ok) {
    return;
  }

  const getResponse = await fetch(
    path,
    createFetchInit(options, 'GET'),
  );

  if (!getResponse.ok) {
    throw new Error(
      `[artifacts] Artifact not found: ${path} (HTTP ${getResponse.status}). ` +
        `Ensure app/public/circuit/${CIRCUIT_VERSION}/ contains the correct files.`,
    );
  }
}

export function getDefaultCircuitArtifactPaths(): CircuitArtifactPaths {
  return { ...DEFAULT_PATHS };
}

export async function loadCircuitArtifacts(
  options: LoadArtifactOptions = {},
): Promise<CircuitArtifacts> {
  if (artifactCache?.version === CIRCUIT_VERSION) {
    return {
      wasm: artifactCache.wasm,
      zkey: artifactCache.zkey,
    };
  }

  const paths = resolvePaths(options.paths);

  console.info('[artifacts] Loading circuit artifacts...');

  const [wasm, zkey] = await Promise.all([
    fetchBinaryArtifact(paths.wasmPath, options),
    fetchBinaryArtifact(paths.zkeyPath, options),
  ]);

  artifactCache = {
    wasm,
    zkey,
    version: CIRCUIT_VERSION,
    loadedAt: Date.now(),
  };

  console.info(
    `[artifacts] Loaded: WASM=${wasm.byteLength} bytes | ZKEY=${zkey.byteLength} bytes`,
  );

  return { wasm, zkey };
}

export async function loadVerificationKey(
  options: LoadArtifactOptions = {},
): Promise<unknown> {
  if (verificationKeyCache !== null) {
    return verificationKeyCache;
  }

  const paths = resolvePaths(options.paths);

  verificationKeyCache = await fetchJsonArtifact(
    paths.verificationKeyPath,
    options,
  );

  return verificationKeyCache;
}

export async function validateCircuitArtifacts(
  options: LoadArtifactOptions = {},
): Promise<void> {
  const paths = resolvePaths(options.paths);

  await Promise.all([
    checkArtifactExists(paths.wasmPath, options),
    checkArtifactExists(paths.zkeyPath, options),
    checkArtifactExists(paths.verificationKeyPath, options),
  ]);
}

export function clearCircuitArtifactCache(): void {
  artifactCache = null;
  verificationKeyCache = null;

  console.info('[artifacts] Cache cleared.');
}
