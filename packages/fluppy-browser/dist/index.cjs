'use strict';

var core = require('@fluppy/core');
var circomlibjs = require('circomlibjs');

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

// src/index.ts
var FLUPPY_BROWSER_VERSION = "0.1.0";

exports.FLUPPY_BROWSER_VERSION = FLUPPY_BROWSER_VERSION;
exports.computeCommitment = computeCommitment;
exports.enrollCommitment = enrollCommitment;
exports.getMerkleProof = getMerkleProof;
Object.keys(core).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return core[k]; }
  });
});
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map