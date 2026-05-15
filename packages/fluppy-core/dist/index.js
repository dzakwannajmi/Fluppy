import { Networks, Address, hash } from '@stellar/stellar-sdk';

// src/constants.ts
var BN254_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
var CIRCUIT_DEPTH = 20;
var N_PUBLIC = 7;
var POSEIDON_TAGS = {
  NULLIFIER: 1n,
  // Poseidon(1, secret, nonce)
  LEAF: 2n,
  // Poseidon(2, secret)
  NODE: 3n
  // Poseidon(3, left, right)
};
var DEFAULT_MIN_AMOUNT = 0n;
var DEFAULT_MAX_AMOUNT = BigInt(1e3 * 1e7);
var USDC_DECIMALS = 7;
function usdcToStroops(amount) {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed < 0) {
    throw new RangeError(`Invalid USDC amount: ${amount}`);
  }
  return BigInt(Math.floor(parsed * 10 ** USDC_DECIMALS));
}

// src/errors.ts
var FluppyError = class extends Error {
  code;
  userMessage;
  action;
  constructor(code, userMessage, action, cause) {
    super(userMessage, { cause });
    this.name = "FluppyError";
    this.code = code;
    this.userMessage = userMessage;
    this.action = action;
  }
  toJSON() {
    return {
      code: this.code,
      userMessage: this.userMessage,
      action: this.action
    };
  }
};
var FluppyProofError = class extends FluppyError {
  constructor(message, cause) {
    super("PROOF_FAILED", message, "retry", cause);
    this.name = "FluppyProofError";
  }
};
var FluppyNetworkError = class extends FluppyError {
  constructor(message, cause) {
    super("NETWORK_ERROR", message, "retry", cause);
    this.name = "FluppyNetworkError";
  }
};
var FluppyWalletError = class extends FluppyError {
  constructor(code, userMessage, cause) {
    super(code, userMessage, "retry", cause);
    this.name = "FluppyWalletError";
  }
};
var FluppyRootMismatchError = class extends FluppyError {
  proofRoot;
  contractRoot;
  constructor(proofRoot, contractRoot) {
    super(
      "ROOT_MISMATCH",
      "Your enrollment state may have changed. Please retry the payment.",
      "retry"
    );
    this.name = "FluppyRootMismatchError";
    this.proofRoot = proofRoot;
    this.contractRoot = contractRoot;
  }
};
var FluppyArtifactError = class extends FluppyError {
  constructor(message, cause) {
    super(
      "ARTIFACT_ERROR",
      message,
      "contact_support",
      cause
    );
    this.name = "FluppyArtifactError";
  }
};
var FluppyContractError = class extends FluppyError {
  contractCode;
  constructor(contractCode, userMessage, action) {
    super(
      `CONTRACT_${contractCode}`,
      userMessage,
      action
    );
    this.name = "FluppyContractError";
    this.contractCode = contractCode;
  }
};
var CONTRACT_ERROR_MAP = {
  "#1": {
    code: "NOT_INITIALIZED",
    userMessage: "Contract is not yet initialized. Please contact support.",
    action: "contact_support"
  },
  "#2": {
    code: "ALREADY_INITIALIZED",
    userMessage: "Contract setup conflict. Please contact support.",
    action: "contact_support"
  },
  "#3": {
    code: "NOT_ADMIN",
    userMessage: "Unauthorized operation.",
    action: "contact_support"
  },
  "#4": {
    code: "NULLIFIER_SPENT",
    userMessage: "This payment proof was already used. Please generate a new payment.",
    action: "reconnect"
  },
  "#5": {
    code: "INVALID_PROOF",
    userMessage: "Payment proof is invalid. Please retry or contact support.",
    action: "retry"
  },
  "#6": {
    code: "RECIPIENT_MISMATCH",
    userMessage: "Recipient address mismatch. Please verify the merchant address.",
    action: "contact_support"
  },
  "#7": {
    code: "INVALID_AMOUNT",
    userMessage: "Payment amount is outside the allowed range.",
    action: "retry"
  },
  "#8": {
    code: "CONTRACT_PAUSED",
    userMessage: "Payments are temporarily paused. Please try again later.",
    action: "retry"
  },
  "#9": {
    code: "INVALID_INPUT_COUNT",
    userMessage: "Proof format is incompatible. Please refresh and try again.",
    action: "reconnect"
  },
  "#10": {
    code: "ARITHMETIC_OVERFLOW",
    userMessage: "Internal calculation error. Please contact support.",
    action: "contact_support"
  },
  "#11": {
    code: "CIRCUIT_ROOT_MISMATCH",
    userMessage: "Proof root verification failed. Please refresh and retry.",
    action: "retry"
  },
  "#12": {
    code: "ROOT_MISMATCH",
    userMessage: "Your enrollment state may have changed. Please retry the payment.",
    action: "retry"
  },
  "#13": {
    code: "CHAIN_ID_MISMATCH",
    userMessage: "Network mismatch detected. Please ensure you are on the correct network.",
    action: "reconnect"
  }
};
function parseFluppyError(err) {
  if (err instanceof FluppyError) {
    return err;
  }
  const message = extractErrorMessage(err);
  const contractMatch = message.match(/Error\(Contract,\s*#(\d+)\)/);
  const contractCodeText = contractMatch?.[1];
  if (contractCodeText) {
    const key = `#${contractCodeText}`;
    const contractCode = Number.parseInt(contractCodeText, 10);
    const mapped = CONTRACT_ERROR_MAP[key];
    if (mapped) {
      return new FluppyError(
        mapped.code,
        mapped.userMessage,
        mapped.action,
        err
      );
    }
    return new FluppyContractError(
      contractCode,
      `Payment failed with contract error ${key}. Please contact support.`,
      "contact_support"
    );
  }
  if (message.includes("commitment_not_enrolled")) {
    return new FluppyError(
      "NOT_ENROLLED",
      "Your credential is not enrolled. Please complete onboarding.",
      "contact_support",
      err
    );
  }
  if (message.includes("invalid_commitment_format")) {
    return new FluppyError(
      "INVALID_COMMITMENT",
      "Credential format error. Please refresh and try again.",
      "reconnect",
      err
    );
  }
  if (message.includes("txTooLate")) {
    return new FluppyError(
      "TIMEOUT",
      "Transaction expired due to network delay. Please try again.",
      "retry",
      err
    );
  }
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("user declined") || lowerMessage.includes("user rejected") || lowerMessage.includes("rejected by user")) {
    return new FluppyWalletError(
      "USER_REJECTED",
      "Transaction was cancelled.",
      err
    );
  }
  if (lowerMessage.includes("freighter") && lowerMessage.includes("not installed")) {
    return new FluppyWalletError(
      "WALLET_NOT_FOUND",
      "Freighter wallet is not installed. Please install it and try again.",
      err
    );
  }
  if (message.includes("[ZKP] Local verification FAILED") || message.includes("Local verification FAILED")) {
    return new FluppyError(
      "PROOF_INVALID_LOCAL",
      "Proof verification failed locally. Please refresh and retry.",
      "retry",
      err
    );
  }
  if (lowerMessage.includes("wrong password") || lowerMessage.includes("decryption") || message.includes("OperationError")) {
    return new FluppyError(
      "WRONG_PASSWORD",
      "Incorrect password. Please try again.",
      "retry",
      err
    );
  }
  if (message.includes("No credential found") || message.includes("Credential belum dibuat")) {
    return new FluppyError(
      "NO_CREDENTIAL",
      "No credential found. Please create one first.",
      "reconnect",
      err
    );
  }
  if (message.includes("Secret not found") || message.includes("not found in whitelist")) {
    return new FluppyError(
      "SECRET_NOT_IN_TREE",
      "Your credential is not in the payment whitelist. Please contact support.",
      "contact_support",
      err
    );
  }
  if (message.includes("RPC submission") || lowerMessage.includes("network error") || message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return new FluppyNetworkError(
      "Network error. Please check your connection and try again.",
      err
    );
  }
  return new FluppyError(
    "UNKNOWN",
    "Something went wrong. Please try again or contact support.",
    "retry",
    err
  );
}
function extractErrorMessage(err) {
  if (err instanceof Error) {
    const cause = err.cause;
    if (cause instanceof Error) {
      return `${err.message} \u2014 ${cause.message}`;
    }
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// src/encoding.ts
function decimalToBe32Hex(decimal) {
  const value = BigInt(decimal);
  if (value < 0n || value >= 2n ** 256n) {
    throw new RangeError(`Field element out of range: ${decimal}`);
  }
  return value.toString(16).padStart(64, "0");
}
function encodeG1(point) {
  const [x, y] = point;
  return decimalToBe32Hex(x) + decimalToBe32Hex(y);
}
function encodeG2(point) {
  const [x, y] = point;
  return decimalToBe32Hex(x[0]) + decimalToBe32Hex(x[1]) + decimalToBe32Hex(y[0]) + decimalToBe32Hex(y[1]);
}
function hexSecretToFieldElement(hexSecret) {
  if (!/^[0-9a-f]{64}$/i.test(hexSecret)) {
    throw new TypeError(
      "Invalid secret format: must be a 64-character hex string"
    );
  }
  const raw = BigInt(`0x${hexSecret}`);
  const reduced = raw % BN254_R;
  return reduced.toString();
}
function computeRecipientHash(stellarAddress) {
  const address = Address.fromString(stellarAddress);
  const xdrBytes = address.toScVal().toXDR();
  const hashed = hash(xdrBytes);
  hashed[0] = 0;
  return BigInt(`0x${hashed.toString("hex")}`).toString();
}
var STELLAR_NETWORKS = {
  TESTNET: Networks.TESTNET,
  MAINNET: Networks.PUBLIC
};
function computeChainId(networkPassphrase) {
  if (networkPassphrase.trim() === "") {
    throw new TypeError("Network passphrase cannot be empty");
  }
  const passphraseBytes = Buffer.from(networkPassphrase, "utf8");
  const hashed = hash(passphraseBytes);
  hashed[0] = 0;
  return BigInt(`0x${hashed.toString("hex")}`).toString();
}

// src/index.ts
var FLUPPY_CORE_VERSION = "0.1.0";

export { BN254_R, CIRCUIT_DEPTH, DEFAULT_MAX_AMOUNT, DEFAULT_MIN_AMOUNT, FLUPPY_CORE_VERSION, FluppyArtifactError, FluppyContractError, FluppyError, FluppyNetworkError, FluppyProofError, FluppyRootMismatchError, FluppyWalletError, N_PUBLIC, POSEIDON_TAGS, STELLAR_NETWORKS, USDC_DECIMALS, computeChainId, computeRecipientHash, decimalToBe32Hex, encodeG1, encodeG2, hexSecretToFieldElement, parseFluppyError, usdcToStroops };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map