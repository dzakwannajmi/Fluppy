export type TraceStep =
    | 'trace:created'
    | 'credential:create'
    | 'credential:decrypt'
    | 'merkle:request'
    | 'merkle:received'
    | 'proof:start'
    | 'proof:witness_start'
    | 'proof:witness_done'
    | 'proof:generating'
    | 'proof:verify_local'
    | 'proof:done'
    | 'wallet:sign_request'
    | 'wallet:signed'
    | 'wallet:rejected'
    | 'tx:submit'
    | 'tx:polling'
    | 'tx:confirmed'
    | 'tx:failed';

// ─────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────

export interface PaymentTrace {
    traceId: string;
    startedAt: number;
}

// ─────────────────────────────────────────────────────────────
// INTERNAL TYPES
// ─────────────────────────────────────────────────────────────

interface StepEntry {
    step: TraceStep | string;
    elapsed: number;
    data?: Record<string, unknown>;
}

interface TraceSummary {
    status: 'success' | 'failed';
    started_at: number;
    finished_at: number;
    total_ms: number;
    step_count: number;
    steps: string[];
    [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// INTERNAL STATE
// ─────────────────────────────────────────────────────────────

const activeTraces = new Map<string, StepEntry[]>();

const TRACE_ENABLED = process.env.NEXT_PUBLIC_TRACE === 'true';

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Creates a new payment trace lifecycle.
 */
export function createPaymentTrace(): PaymentTrace {
    const trace: PaymentTrace = {
        traceId: generateTraceId(),
        startedAt: Date.now(),
    };

    activeTraces.set(trace.traceId, []);

    log(trace.traceId, 'trace:created', {});

    return trace;
}

/**
 * Records a trace lifecycle step.
 *
 * Safe to call multiple times.
 * Silently ignores finalized traces.
 */
export function traceStep(
    trace: PaymentTrace,
    step: TraceStep | string,
    data?: Record<string, unknown>,
): void {
    const entries = activeTraces.get(trace.traceId);

    // Ignore finalized traces
    if (!entries) {
        return;
    }

    const elapsed = Date.now() - trace.startedAt;

    const previous =
        entries.length > 0
            ? entries[entries.length - 1]
            : null;

    const stepDuration =
        previous
            ? elapsed - previous.elapsed
            : elapsed;

    const entry: StepEntry = {
        step,
        elapsed,
        data: {
            ...data,
            step_duration_ms: stepDuration,
        },
    };

    entries.push(entry);

    activeTraces.set(trace.traceId, entries);

    log(trace.traceId, step, {
        elapsed_ms: elapsed,
        step_duration_ms: stepDuration,
        ...data,
    });

    if (
        TRACE_ENABLED &&
        process.env.NODE_ENV === 'development' &&
        stepDuration > 15_000
    ) {
        console.warn(
            `[TRACE] Slow step detected: ${step} (${stepDuration}ms)`,
        );
    }
}

/**
 * Finalizes a payment trace lifecycle.
 *
 * Safe against duplicate finalization attempts.
 */
export function finalizeTrace(
    trace: PaymentTrace,
    status: 'success' | 'failed',
    data?: Record<string, unknown>,
): void {
    const entries = activeTraces.get(trace.traceId);

    // Already finalized
    if (!entries) {
        return;
    }

    const finishedAt = Date.now();

    traceStep(
        trace,
        status === 'success' ? 'tx:confirmed' : 'tx:failed',
        data,
    );

    const finalEntries =
        activeTraces.get(trace.traceId) ?? [];

    const totalMs =
        finishedAt - trace.startedAt;

    const summary: TraceSummary = {
        status,
        started_at: trace.startedAt,
        finished_at: finishedAt,
        total_ms: totalMs,
        step_count: finalEntries.length,
        steps: finalEntries.map(
            entry => `${entry.step}@${entry.elapsed}ms`,
        ),
        ...data,
    };

    log(
        trace.traceId,
        'trace:summary',
        summary,
    );

    if (
        TRACE_ENABLED &&
        process.env.NODE_ENV === 'development'
    ) {
        console.groupCollapsed(
            `[TRACE] ${trace.traceId} ${status.toUpperCase()} (${totalMs}ms)`,
        );

        console.table(finalEntries);

        console.groupEnd();
    }

    activeTraces.delete(trace.traceId);
}

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random trace ID.
 *
 * Browser:
 *   Uses Web Crypto API
 *
 * SSR fallback:
 *   Uses timestamp + Math.random
 */
function generateTraceId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = crypto.getRandomValues(new Uint8Array(8));

        return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    // SSR/runtime fallback
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/**
 * Internal structured logger.
 *
 * Logging can be toggled via:
 * NEXT_PUBLIC_TRACE=true
 */
function log(traceId: string, step: string, data: Record<string, unknown>): void {
    if (!TRACE_ENABLED) {
        return;
    }

    const suffix = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';

    console.log(`[TRACE] ${traceId} ${step}${suffix}`);
}