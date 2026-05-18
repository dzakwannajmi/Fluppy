import { POSEIDON_TAGS, BN254_R } from '@fluppy/core';
export * from '@fluppy/core';
import { buildPoseidon } from 'circomlibjs';

// src/index.ts
var poseidonInstance = null;
async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}
function resolveApiUrl(path, options) {
  const baseUrl = options?.baseUrl ?? "";
  return `${baseUrl}${path}`;
}
function validateSecret(secret) {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error("[Merkle] Invalid secret: must be 64-char hex string.");
  }
}
function secretToField(hexSecret) {
  return BigInt(`0x${hexSecret}`) % BN254_R;
}
function commitmentToHex(commitment) {
  return commitment.toString(16).padStart(64, "0").toLowerCase();
}
async function readApiError(response, fallback) {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return String(
        data.error ?? data.message ?? fallback
      );
    }
    return `${fallback}. HTTP ${response.status}`;
  } catch {
    return `${fallback}. HTTP ${response.status}`;
  }
}
async function computeCommitment(secret) {
  validateSecret(secret);
  const poseidon = await getPoseidon();
  const field = secretToField(secret);
  return poseidon.F.toObject(
    poseidon([
      POSEIDON_TAGS.LEAF,
      field
    ])
  );
}
async function enrollCommitment(secret, options) {
  const commitment = await computeCommitment(secret);
  const commitmentHex = commitmentToHex(commitment);
  const response = await fetch(
    resolveApiUrl("/api/merkle-proof/enroll", options),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        commitment: commitmentHex
      })
    }
  );
  if (!response.ok) {
    const error = await readApiError(
      response,
      "[Merkle] Enrollment failed"
    );
    throw new Error(error);
  }
  return await response.json();
}
async function getMerkleProof(secret, options) {
  const commitment = await computeCommitment(secret);
  const commitmentHex = commitmentToHex(commitment);
  console.log(
    "[Merkle] Requesting proof for commitment:",
    `${commitmentHex.slice(0, 16)}...`
  );
  const response = await fetch(
    resolveApiUrl("/api/merkle-proof", options),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        commitment: commitmentHex
      })
    }
  );
  if (!response.ok) {
    const error = await readApiError(
      response,
      "[Merkle] Proof request failed"
    );
    throw new Error(`[Merkle] ${error}`);
  }
  const data = await response.json();
  console.log(
    `[Merkle] Proof received. Root: ${data.root.slice(0, 20)}...`
  );
  return {
    pathElements: data.pathElements.map((element) => BigInt(element)),
    pathIndices: data.pathIndices,
    root: BigInt(data.root)
  };
}

// src/artifacts.ts
var CIRCUIT_VERSION = "v3";
var BASE_PATH = `/circuit/${CIRCUIT_VERSION}`;
var DEFAULT_PATHS = {
  wasmPath: `${BASE_PATH}/fluppy_payment.wasm`,
  zkeyPath: `${BASE_PATH}/circuit_final.zkey`,
  verificationKeyPath: `${BASE_PATH}/verification_key.json`
};
var artifactCache = null;
var verificationKeyCache = null;
function resolvePaths(overrides) {
  return {
    wasmPath: overrides?.wasmPath ?? DEFAULT_PATHS.wasmPath,
    zkeyPath: overrides?.zkeyPath ?? DEFAULT_PATHS.zkeyPath,
    verificationKeyPath: overrides?.verificationKeyPath ?? DEFAULT_PATHS.verificationKeyPath
  };
}
function createFetchInit(options, method = "GET") {
  const init = {
    method,
    cache: options.cache ?? "no-store"
  };
  if (options.signal) {
    init.signal = options.signal;
  }
  return init;
}
async function fetchBinaryArtifact(path, options) {
  const response = await fetch(path, createFetchInit(options, "GET"));
  if (!response.ok) {
    throw new Error(
      `[artifacts] Failed to load artifact: ${path} (HTTP ${response.status})`
    );
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
async function fetchJsonArtifact(path, options) {
  const response = await fetch(path, createFetchInit(options, "GET"));
  if (!response.ok) {
    throw new Error(
      `[artifacts] Failed to load JSON artifact: ${path} (HTTP ${response.status})`
    );
  }
  return await response.json();
}
async function checkArtifactExists(path, options) {
  const headResponse = await fetch(
    path,
    createFetchInit(options, "HEAD")
  ).catch(() => null);
  if (headResponse?.ok) {
    return;
  }
  const getResponse = await fetch(
    path,
    createFetchInit(options, "GET")
  );
  if (!getResponse.ok) {
    throw new Error(
      `[artifacts] Artifact not found: ${path} (HTTP ${getResponse.status}). Ensure app/public/circuit/${CIRCUIT_VERSION}/ contains the correct files.`
    );
  }
}
function getDefaultCircuitArtifactPaths() {
  return { ...DEFAULT_PATHS };
}
async function loadCircuitArtifacts(options = {}) {
  if (artifactCache?.version === CIRCUIT_VERSION) {
    return {
      wasm: artifactCache.wasm,
      zkey: artifactCache.zkey
    };
  }
  const paths = resolvePaths(options.paths);
  console.info("[artifacts] Loading circuit artifacts...");
  const [wasm, zkey] = await Promise.all([
    fetchBinaryArtifact(paths.wasmPath, options),
    fetchBinaryArtifact(paths.zkeyPath, options)
  ]);
  artifactCache = {
    wasm,
    zkey,
    version: CIRCUIT_VERSION,
    loadedAt: Date.now()
  };
  console.info(
    `[artifacts] Loaded: WASM=${wasm.byteLength} bytes | ZKEY=${zkey.byteLength} bytes`
  );
  return { wasm, zkey };
}
async function loadVerificationKey(options = {}) {
  if (verificationKeyCache !== null) {
    return verificationKeyCache;
  }
  const paths = resolvePaths(options.paths);
  verificationKeyCache = await fetchJsonArtifact(
    paths.verificationKeyPath,
    options
  );
  return verificationKeyCache;
}
async function validateCircuitArtifacts(options = {}) {
  const paths = resolvePaths(options.paths);
  await Promise.all([
    checkArtifactExists(paths.wasmPath, options),
    checkArtifactExists(paths.zkeyPath, options),
    checkArtifactExists(paths.verificationKeyPath, options)
  ]);
}
function clearCircuitArtifactCache() {
  artifactCache = null;
  verificationKeyCache = null;
  console.info("[artifacts] Cache cleared.");
}

// src/index.ts
var FLUPPY_BROWSER_VERSION = "0.1.0";

export { FLUPPY_BROWSER_VERSION, clearCircuitArtifactCache, computeCommitment, enrollCommitment, getDefaultCircuitArtifactPaths, getMerkleProof, loadCircuitArtifacts, loadVerificationKey, validateCircuitArtifacts };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map