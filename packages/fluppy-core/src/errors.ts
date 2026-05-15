/**
 * Fluppy error model.
 *
 * All SDK-level errors should extend FluppyError so app, browser SDK,
 * and React SDK can handle errors consistently.
 */

export type FluppyErrorAction =
  | 'retry'
  | 'contact_support'
  | 'reconnect';

export type FluppyErrorCode =
  | 'NOT_INITIALIZED'
  | 'ALREADY_INITIALIZED'
  | 'NOT_ADMIN'
  | 'NULLIFIER_SPENT'
  | 'INVALID_PROOF'
  | 'RECIPIENT_MISMATCH'
  | 'INVALID_AMOUNT'
  | 'CONTRACT_PAUSED'
  | 'INVALID_INPUT_COUNT'
  | 'ARITHMETIC_OVERFLOW'
  | 'CIRCUIT_ROOT_MISMATCH'
  | 'ROOT_MISMATCH'
  | 'CHAIN_ID_MISMATCH'
  | 'NOT_ENROLLED'
  | 'INVALID_COMMITMENT'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'USER_REJECTED'
  | 'WALLET_NOT_FOUND'
  | 'WALLET_ERROR'
  | 'PROOF_FAILED'
  | 'PROOF_INVALID_LOCAL'
  | 'WRONG_PASSWORD'
  | 'NO_CREDENTIAL'
  | 'SECRET_NOT_IN_TREE'
  | 'ARTIFACT_ERROR'
  | 'ARTIFACT_INTEGRITY_FAILED'
  | `CONTRACT_${number}`
  | 'UNKNOWN';

export interface ParsedFluppyError {
  readonly code: FluppyErrorCode;
  readonly userMessage: string;
  readonly action: FluppyErrorAction | undefined;
}

/**
 * Base error class for all Fluppy SDK errors.
 */
export class FluppyError extends Error {
  readonly code: FluppyErrorCode;
  readonly userMessage: string;
  readonly action: FluppyErrorAction | undefined;

  constructor(
    code: FluppyErrorCode,
    userMessage: string,
    action?: FluppyErrorAction,
    cause?: unknown,
  ) {
    super(userMessage, { cause });

    this.name = 'FluppyError';
    this.code = code;
    this.userMessage = userMessage;
    this.action = action;
  }

  toJSON(): ParsedFluppyError {
    return {
      code: this.code,
      userMessage: this.userMessage,
      action: this.action,
    };
  }
}

/**
 * Error thrown during proof generation or proof verification.
 */
export class FluppyProofError extends FluppyError {
  constructor(message: string, cause?: unknown) {
    super('PROOF_FAILED', message, 'retry', cause);
    this.name = 'FluppyProofError';
  }
}

/**
 * Error thrown when network requests fail.
 */
export class FluppyNetworkError extends FluppyError {
  constructor(message: string, cause?: unknown) {
    super('NETWORK_ERROR', message, 'retry', cause);
    this.name = 'FluppyNetworkError';
  }
}

/**
 * Error thrown during wallet interactions.
 */
export class FluppyWalletError extends FluppyError {
  constructor(
    code: 'WALLET_NOT_FOUND' | 'USER_REJECTED' | 'WALLET_ERROR',
    userMessage: string,
    cause?: unknown,
  ) {
    super(code, userMessage, 'retry', cause);
    this.name = 'FluppyWalletError';
  }
}

/**
 * Error thrown when proof root and on-chain root do not match.
 */
export class FluppyRootMismatchError extends FluppyError {
  readonly proofRoot: string;
  readonly contractRoot: string;

  constructor(proofRoot: string, contractRoot: string) {
    super(
      'ROOT_MISMATCH',
      'Your enrollment state may have changed. Please retry the payment.',
      'retry',
    );

    this.name = 'FluppyRootMismatchError';
    this.proofRoot = proofRoot;
    this.contractRoot = contractRoot;
  }
}

/**
 * Error thrown when circuit artifacts fail to load or verify.
 */
export class FluppyArtifactError extends FluppyError {
  constructor(message: string, cause?: unknown) {
    super(
      'ARTIFACT_ERROR',
      message,
      'contact_support',
      cause,
    );

    this.name = 'FluppyArtifactError';
  }
}

/**
 * Error thrown when the Soroban contract returns a numeric error code.
 */
export class FluppyContractError extends FluppyError {
  readonly contractCode: number;

  constructor(
    contractCode: number,
    userMessage: string,
    action?: FluppyErrorAction,
  ) {
    super(
      `CONTRACT_${contractCode}` as FluppyErrorCode,
      userMessage,
      action,
    );

    this.name = 'FluppyContractError';
    this.contractCode = contractCode;
  }
}

interface ContractErrorMapping {
  readonly code: FluppyErrorCode;
  readonly userMessage: string;
  readonly action: FluppyErrorAction;
}

const CONTRACT_ERROR_MAP: Readonly<Record<string, ContractErrorMapping>> = {
  '#1': {
    code: 'NOT_INITIALIZED',
    userMessage: 'Contract is not yet initialized. Please contact support.',
    action: 'contact_support',
  },
  '#2': {
    code: 'ALREADY_INITIALIZED',
    userMessage: 'Contract setup conflict. Please contact support.',
    action: 'contact_support',
  },
  '#3': {
    code: 'NOT_ADMIN',
    userMessage: 'Unauthorized operation.',
    action: 'contact_support',
  },
  '#4': {
    code: 'NULLIFIER_SPENT',
    userMessage: 'This payment proof was already used. Please generate a new payment.',
    action: 'reconnect',
  },
  '#5': {
    code: 'INVALID_PROOF',
    userMessage: 'Payment proof is invalid. Please retry or contact support.',
    action: 'retry',
  },
  '#6': {
    code: 'RECIPIENT_MISMATCH',
    userMessage: 'Recipient address mismatch. Please verify the merchant address.',
    action: 'contact_support',
  },
  '#7': {
    code: 'INVALID_AMOUNT',
    userMessage: 'Payment amount is outside the allowed range.',
    action: 'retry',
  },
  '#8': {
    code: 'CONTRACT_PAUSED',
    userMessage: 'Payments are temporarily paused. Please try again later.',
    action: 'retry',
  },
  '#9': {
    code: 'INVALID_INPUT_COUNT',
    userMessage: 'Proof format is incompatible. Please refresh and try again.',
    action: 'reconnect',
  },
  '#10': {
    code: 'ARITHMETIC_OVERFLOW',
    userMessage: 'Internal calculation error. Please contact support.',
    action: 'contact_support',
  },
  '#11': {
    code: 'CIRCUIT_ROOT_MISMATCH',
    userMessage: 'Proof root verification failed. Please refresh and retry.',
    action: 'retry',
  },
  '#12': {
    code: 'ROOT_MISMATCH',
    userMessage: 'Your enrollment state may have changed. Please retry the payment.',
    action: 'retry',
  },
  '#13': {
    code: 'CHAIN_ID_MISMATCH',
    userMessage: 'Network mismatch detected. Please ensure you are on the correct network.',
    action: 'reconnect',
  },
};

/**
 * Parses any thrown value into a structured FluppyError.
 */
export function parseFluppyError(err: unknown): FluppyError {
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
        err,
      );
    }

    return new FluppyContractError(
      contractCode,
      `Payment failed with contract error ${key}. Please contact support.`,
      'contact_support',
    );
  }

  if (message.includes('commitment_not_enrolled')) {
    return new FluppyError(
      'NOT_ENROLLED',
      'Your credential is not enrolled. Please complete onboarding.',
      'contact_support',
      err,
    );
  }

  if (message.includes('invalid_commitment_format')) {
    return new FluppyError(
      'INVALID_COMMITMENT',
      'Credential format error. Please refresh and try again.',
      'reconnect',
      err,
    );
  }

  if (message.includes('txTooLate')) {
    return new FluppyError(
      'TIMEOUT',
      'Transaction expired due to network delay. Please try again.',
      'retry',
      err,
    );
  }

  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('user declined') ||
    lowerMessage.includes('user rejected') ||
    lowerMessage.includes('rejected by user')
  ) {
    return new FluppyWalletError(
      'USER_REJECTED',
      'Transaction was cancelled.',
      err,
    );
  }

  if (
    lowerMessage.includes('freighter') &&
    lowerMessage.includes('not installed')
  ) {
    return new FluppyWalletError(
      'WALLET_NOT_FOUND',
      'Freighter wallet is not installed. Please install it and try again.',
      err,
    );
  }

  if (
    message.includes('[ZKP] Local verification FAILED') ||
    message.includes('Local verification FAILED')
  ) {
    return new FluppyError(
      'PROOF_INVALID_LOCAL',
      'Proof verification failed locally. Please refresh and retry.',
      'retry',
      err,
    );
  }

  if (
    lowerMessage.includes('wrong password') ||
    lowerMessage.includes('decryption') ||
    message.includes('OperationError')
  ) {
    return new FluppyError(
      'WRONG_PASSWORD',
      'Incorrect password. Please try again.',
      'retry',
      err,
    );
  }

  if (
    message.includes('No credential found') ||
    message.includes('Credential belum dibuat')
  ) {
    return new FluppyError(
      'NO_CREDENTIAL',
      'No credential found. Please create one first.',
      'reconnect',
      err,
    );
  }

  if (
    message.includes('Secret not found') ||
    message.includes('not found in whitelist')
  ) {
    return new FluppyError(
      'SECRET_NOT_IN_TREE',
      'Your credential is not in the payment whitelist. Please contact support.',
      'contact_support',
      err,
    );
  }

  if (
    message.includes('RPC submission') ||
    lowerMessage.includes('network error') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('err_empty_response') ||
    message.includes('ERR_EMPTY_RESPONSE')
  ) {
    return new FluppyNetworkError(
      'Network error. Please check your connection and try again.',
      err,
    );
  } 

  return new FluppyError(
    'UNKNOWN',
    'Something went wrong. Please try again or contact support.',
    'retry',
    err,
  );
}

/**
 * Extracts a readable string from any thrown value.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause;

    if (cause instanceof Error) {
      return `${err.message} — ${cause.message}`;
    }

    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
