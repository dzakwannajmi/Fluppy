'use strict';

var core = require('@fluppy/core');
var circomlibjs = require('circomlibjs');
var snarkjs = require('snarkjs');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var snarkjs__namespace = /*#__PURE__*/_interopNamespace(snarkjs);

// src/index.ts
var poseidonInstance = null;
async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await circomlibjs.buildPoseidon();
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
  return BigInt(`0x${hexSecret}`) % core.BN254_R;
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
      core.POSEIDON_TAGS.LEAF,
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
var MAX_PAYMENT_AMOUNT_STROOPS = BigInt(1e3 * 10 ** 7);
var activeGenerationId = null;
function createGenerationId() {
  const bytes = crypto.getRandomValues(
    new Uint8Array(8)
  );
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function acquireGenerationLock() {
  if (activeGenerationId !== null) {
    throw new Error(
      "[prover] Another proof generation is already in progress"
    );
  }
  const generationId = createGenerationId();
  activeGenerationId = generationId;
  return generationId;
}
function releaseGenerationLock(generationId) {
  if (activeGenerationId === generationId) {
    activeGenerationId = null;
  }
}
function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException(
      "Proof generation was aborted",
      "AbortError"
    );
  }
}
function createProgressUpdater(callback) {
  return {
    update(stage, pct) {
      callback?.(stage, pct);
    },
    complete() {
      callback?.("Completed", 100);
    }
  };
}
function generateSecureNonce() {
  const bytes = crypto.getRandomValues(
    new Uint8Array(32)
  );
  const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const raw = BigInt(`0x${hex}`);
  return (raw % core.BN254_R).toString();
}
function validateProofInputs(secret, pathElements, pathIndices) {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      "[prover] Invalid secret format: must be 64-char hex string"
    );
  }
  if (pathElements.length !== core.CIRCUIT_DEPTH) {
    throw new Error(
      `[prover] pathElements length ${pathElements.length} !== CIRCUIT_DEPTH ${core.CIRCUIT_DEPTH}`
    );
  }
  if (pathIndices.length !== core.CIRCUIT_DEPTH) {
    throw new Error(
      `[prover] pathIndices length ${pathIndices.length} !== CIRCUIT_DEPTH ${core.CIRCUIT_DEPTH}`
    );
  }
}
function buildCircuitInputs(input) {
  const {
    secret,
    merkleProof,
    recipient,
    amount,
    networkPassphrase
  } = input;
  const {
    pathElements,
    pathIndices,
    root
  } = merkleProof;
  return {
    secret: core.hexSecretToFieldElement(secret),
    nonce: generateSecureNonce(),
    amount: amount.toString(),
    pathElements: pathElements.map((element) => element.toString()),
    pathIndices: [...pathIndices],
    merkleRoot: root.toString(),
    recipientHash: core.computeRecipientHash(recipient),
    minAmount: "0",
    maxAmount: MAX_PAYMENT_AMOUNT_STROOPS.toString(),
    chainId: core.computeChainId(networkPassphrase)
  };
}
function validateRootConsistency(publicSignals) {
  const verifiedRoot = BigInt(publicSignals[1] ?? "0");
  const providedRoot = BigInt(publicSignals[2] ?? "0");
  if (verifiedRoot !== providedRoot) {
    throw new Error(
      "[prover] Merkle root consistency check failed"
    );
  }
}
function encodeProofOutput(proof, publicSignals) {
  if (publicSignals.length !== core.N_PUBLIC) {
    throw new Error(
      `[prover] Public signal count mismatch: got ${publicSignals.length}, expected ${core.N_PUBLIC}`
    );
  }
  const pi_a = core.encodeG1(proof.pi_a);
  const pi_b = core.encodeG2(proof.pi_b);
  const pi_c = core.encodeG1(proof.pi_c);
  const encodedSignals = publicSignals.map(
    (signal) => core.decimalToBe32Hex(signal)
  );
  return {
    pi_a,
    pi_b,
    pi_c,
    publicSignals: encodedSignals
  };
}
function reconstructProofForVerification(proof) {
  return {
    pi_a: [
      BigInt(`0x${proof.pi_a.slice(0, 64)}`).toString(),
      BigInt(`0x${proof.pi_a.slice(64, 128)}`).toString(),
      "1"
    ],
    pi_b: [
      [
        BigInt(`0x${proof.pi_b.slice(0, 64)}`).toString(),
        BigInt(`0x${proof.pi_b.slice(64, 128)}`).toString()
      ],
      [
        BigInt(`0x${proof.pi_b.slice(128, 192)}`).toString(),
        BigInt(`0x${proof.pi_b.slice(192, 256)}`).toString()
      ],
      ["1", "0"]
    ],
    pi_c: [
      BigInt(`0x${proof.pi_c.slice(0, 64)}`).toString(),
      BigInt(`0x${proof.pi_c.slice(64, 128)}`).toString(),
      "1"
    ],
    protocol: "groth16",
    curve: "bn128"
  };
}
async function generateZkProof(input) {
  const {
    secret,
    merkleProof,
    signal,
    onProgress
  } = input;
  const {
    pathElements,
    pathIndices
  } = merkleProof;
  throwIfAborted(signal);
  const generationId = acquireGenerationLock();
  const progress = createProgressUpdater(onProgress);
  try {
    progress.update("Validating artifacts", 5);
    const artifactOptions = signal ? { signal } : {};
    await validateCircuitArtifacts(artifactOptions);
    throwIfAborted(signal);
    validateProofInputs(
      secret,
      pathElements,
      pathIndices
    );
    progress.update("Preparing inputs", 15);
    const circuitInputs = buildCircuitInputs(input);
    throwIfAborted(signal);
    progress.update("Loading artifacts", 25);
    const { wasm, zkey } = await loadCircuitArtifacts(artifactOptions);
    throwIfAborted(signal);
    progress.update("Computing witness", 45);
    const proveResult = await snarkjs__namespace.groth16.fullProve(
      circuitInputs,
      wasm,
      zkey
    );
    throwIfAborted(signal);
    progress.update("Encoding proof", 90);
    validateRootConsistency(
      proveResult.publicSignals
    );
    const output = encodeProofOutput(
      proveResult.proof,
      proveResult.publicSignals
    );
    progress.complete();
    console.info(
      `[prover] Proof generated: pi_a=${output.pi_a.length / 2}B pi_b=${output.pi_b.length / 2}B pi_c=${output.pi_c.length / 2}B`
    );
    return output;
  } finally {
    releaseGenerationLock(generationId);
  }
}
async function verifyProofLocally(proof) {
  try {
    const verificationKey = await loadVerificationKey();
    const reconstructed = reconstructProofForVerification(proof);
    const publicSignals = proof.publicSignals.map(
      (signal) => BigInt(`0x${signal}`).toString()
    );
    const isValid = await snarkjs__namespace.groth16.verify(
      verificationKey,
      publicSignals,
      reconstructed
    );
    console.info(
      `[prover] Local verification: ${isValid ? "\u2713 VALID" : "\u274C INVALID"}`
    );
    return isValid;
  } catch (err) {
    console.error(
      "[prover] Local verification error:",
      err
    );
    return false;
  }
}

// src/index.ts
var FLUPPY_BROWSER_VERSION = "0.1.0";

exports.FLUPPY_BROWSER_VERSION = FLUPPY_BROWSER_VERSION;
exports.clearCircuitArtifactCache = clearCircuitArtifactCache;
exports.computeCommitment = computeCommitment;
exports.enrollCommitment = enrollCommitment;
exports.generateZkProof = generateZkProof;
exports.getDefaultCircuitArtifactPaths = getDefaultCircuitArtifactPaths;
exports.getMerkleProof = getMerkleProof;
exports.loadCircuitArtifacts = loadCircuitArtifacts;
exports.loadVerificationKey = loadVerificationKey;
exports.validateCircuitArtifacts = validateCircuitArtifacts;
exports.verifyProofLocally = verifyProofLocally;
Object.keys(core).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return core[k]; }
  });
});
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map