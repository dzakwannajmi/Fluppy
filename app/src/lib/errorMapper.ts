export interface ParsedError {
  code: string;
  userMessage: string;
  action?: 'retry' | 'contact_support' | 'reconnect';
}

const FALLBACK_ERROR: ParsedError = {
  code: 'UNKNOWN',
  userMessage: 'Something went wrong. Please try again later.',
  action: 'retry',
};

export const parseContractError = (
  error: unknown,
): ParsedError => {
  const errorString =
    error instanceof Error
      ? error.toString()
      : String(error ?? '');

  const errorMessage =
    error instanceof Error
      ? error.message
      : '';

  const lowered =
    `${errorString}\n${errorMessage}`.toLowerCase();

  // ─────────────────────────────────────────────
  // Contract Errors
  // ─────────────────────────────────────────────

  if (errorString.includes('Error(Contract, #1)')) {
    return {
      code: 'NOT_WHITELISTED',
      userMessage:
        'Access denied. Your identity is not in the authorized whitelist.',
      action: 'contact_support',
    };
  }

  if (errorString.includes('Error(Contract, #2)')) {
    return {
      code: 'INSUFFICIENT_BALANCE',
      userMessage:
        'Insufficient balance to complete this transaction.',
      action: 'retry',
    };
  }

  if (errorString.includes('Error(Contract, #3)')) {
    return {
      code: 'PROTOCOL_PAUSED',
      userMessage:
        'Payments are temporarily paused by the administrator.',
      action: 'retry',
    };
  }

  // ─────────────────────────────────────────────
  // Wasm / Contract Init
  // ─────────────────────────────────────────────

  if (
    errorString.includes(
      'Error(WasmVm, InvalidAction)',
    )
  ) {
    return {
      code: 'ALREADY_INITIALIZED',
      userMessage:
        'This contract has already been initialized.',
      action: 'contact_support',
    };
  }

  // ─────────────────────────────────────────────
  // Wallet Errors
  // ─────────────────────────────────────────────

  if (
    errorString.includes(
      'User declined the transaction',
    )
  ) {
    return {
      code: 'USER_REJECTED',
      userMessage:
        'Transaction cancelled in Freighter.',
      action: 'retry',
    };
  }

  // ─────────────────────────────────────────────
  // Validation Errors
  // ─────────────────────────────────────────────

  if (
    errorMessage.includes(
      'Identifier not found in whitelist',
    )
  ) {
    return {
      code: 'IDENTIFIER_NOT_FOUND',
      userMessage:
        'Your identity is not in the authorized whitelist.',
      action: 'contact_support',
    };
  }

  if (
    errorMessage.includes(
      'must contain digits only',
    )
  ) {
    return {
      code: 'INVALID_SECRET_FORMAT',
      userMessage:
        'Invalid ID format. Use digits only.',
      action: 'retry',
    };
  }

  if (
    errorMessage.includes('is required')
  ) {
    return {
      code: 'MISSING_REQUIRED_INPUT',
      userMessage:
        'Please complete all required fields.',
      action: 'retry',
    };
  }

  // ─────────────────────────────────────────────
  // Noir / Barretenberg Mismatch
  // ─────────────────────────────────────────────

  if (
    lowered.includes('deserialize_len') ||
    lowered.includes('bincodedeserialize') ||
    lowered.includes('acir_get_circuit_sizes')
  ) {
    return {
      code: 'ZKP_BACKEND_MISMATCH',
      userMessage:
        'The browser loaded an incompatible ZKP backend. Refresh and rebuild dependencies.',
      action: 'retry',
    };
  }

  // ─────────────────────────────────────────────
  // Network Errors
  // ─────────────────────────────────────────────

  if (
    lowered.includes('network error') ||
    lowered.includes('fetch failed') ||
    lowered.includes('rpc submission')
  ) {
    return {
      code: 'NETWORK_ERROR',
      userMessage:
        'Network connection problem. Please try again.',
      action: 'retry',
    };
  }

  console.error(
    '[errorMapper] Unknown error structure:',
    error,
  );

  return FALLBACK_ERROR;
};