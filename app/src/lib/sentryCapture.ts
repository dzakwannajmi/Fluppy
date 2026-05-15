import * as Sentry from '@sentry/nextjs';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type PaymentPhase =
  | 'credential'
  | 'merkle'
  | 'proof'
  | 'wallet'
  | 'transaction'
  | 'payment';

export interface PaymentErrorContext {
  traceId: string;
  phase: PaymentPhase;
  walletAddr?: string;
  contractId?: string;
  txHash?: string;
  amount?: string;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Captures a payment-related exception safely.
 *
 * SECURITY RULES:
 * - Never include secrets
 * - Never include proof internals
 * - Never include witness data
 * - Never include mnemonic phrases
 * - Wallets are masked
 * - Contract IDs are truncated
 * - txHash is sanitized
 */
export function capturePaymentError(
  err: unknown,
  context: PaymentErrorContext,
): void {
  // Skip during SSR/build environments
  if (typeof window === 'undefined') {
    return;
  }

  // Skip if Sentry disabled
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  const safeContext = {
    traceId: sanitizeText(context.traceId),
    phase: context.phase,
    wallet: context.walletAddr ? maskWallet(context.walletAddr) : undefined,
    contractId: context.contractId ? truncateValue(context.contractId, 12) : undefined,
    txHash: context.txHash ? truncateValue(context.txHash, 16) : undefined,
    amount: context.amount,
  };

  Sentry.captureException(err, {
    tags: {
      component: 'zk_payment',
      phase: context.phase,
    },
    extra: safeContext,
  });
}

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Masks a Stellar wallet address safely.
 *
 * Example:
 * GABC...WXYZ
 */
function maskWallet(wallet: string): string {
  const normalized = sanitizeText(wallet);

  if (normalized.length < 10) {
    return '***';
  }

  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

/**
 * Truncates long values safely.
 *
 * Example:
 * abcdef1234567890 -> abcdef123456...
 */
function truncateValue(value: string, visibleChars: number): string {
  const normalized = sanitizeText(value);

  if (normalized.length <= visibleChars) {
    return normalized;
  }

  return `${normalized.slice(0, visibleChars)}...`;
}

/**
 * Sanitizes arbitrary text for telemetry.
 *
 * Removes:
 * - line breaks
 * - null bytes
 * - excessive whitespace
 */
function sanitizeText(value: string): string {
  return value
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}