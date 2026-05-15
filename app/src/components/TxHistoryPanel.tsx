'use client';

import { useEffect, useRef, useState } from 'react';

import {
  getTxHistory,
  type TxRecord,
} from '../lib/history';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 4000;

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function TxHistoryPanel() {
  const mountedRef = useRef(true);

  const [records, setRecords] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // ───────────────────────────────────────────────────────────
  // LOAD HISTORY
  // ───────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    async function loadHistory(): Promise<void> {
      try {
        const history = await getTxHistory();

        if (!mountedRef.current) {
          return;
        }

        setRecords(history);
      } catch (err) {
        console.error(
          '[TxHistoryPanel] Failed to load history:',
          err,
        );
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    // Initial load
    void loadHistory();

    // Polling refresh
    const interval = window.setInterval(() => {
      void loadHistory();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;

      window.clearInterval(interval);
    };
  }, []);

  // ───────────────────────────────────────────────────────────
  // LOADING
  // ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="animate-pulse text-xs text-white/40">
          Loading transaction history...
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // EMPTY STATE
  // ───────────────────────────────────────────────────────────

  if (records.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs text-white/40">
          No transaction history yet.
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Recent Transactions
        </h3>

        <span className="text-[10px] text-white/20">
          Auto-refresh
        </span>
      </div>

      {/* Records */}
      <div className="flex flex-col gap-2">
        {records.map(record => (
          <TxHistoryItem
            key={record.id}
            record={record}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ITEM COMPONENT
// ─────────────────────────────────────────────────────────────

interface TxHistoryItemProps {
  record: TxRecord;
}

function TxHistoryItem({
  record,
}: TxHistoryItemProps) {
  const isPending =
    record.status === 'pending';

  const txHashDisplay =
    record.txHash === 'pending'
      ? 'Pending...'
      : `${record.txHash.slice(0, 8)}...${record.txHash.slice(-6)}`;

  return (
    <div
      className="
        flex items-center justify-between
        rounded-lg border border-white/5
        bg-white/[0.03]
        px-3 py-2
      "
    >
      {/* Left */}
      <div className="flex min-w-0 flex-col gap-1">
        {/* Hash */}
        <span
          className="
            truncate font-mono text-xs
            text-white/80
          "
        >
          {txHashDisplay}
        </span>

        {/* Meta */}
        <span
          className="
            truncate text-[11px]
            text-white/40
          "
        >
          {record.amount}
          {' → '}
          {shortenAddress(record.recipient)}
        </span>

        {/* Timestamp */}
        <span
          className="
            text-[10px]
            text-white/25
          "
        >
          {formatTimestamp(record.timestamp)}
        </span>
      </div>

      {/* Right */}
      <div className="ml-3 flex items-center gap-3">
        <StatusBadge
          status={record.status}
        />

        {!isPending && record.explorerUrl !== '#' && (
          <a
            href={record.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="
              text-xs text-pink-400
              transition-colors
              hover:text-pink-300
            "
            aria-label="Open transaction in explorer"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: TxRecord['status'];
}

function StatusBadge({
  status,
}: StatusBadgeProps) {
  const styles: Record<
    TxRecord['status'],
    string
  > = {
    pending:
      'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',

    success:
      'bg-green-500/15 text-green-400 border-green-500/20',

    failed:
      'bg-red-500/15 text-red-400 border-red-500/20',
  };

  return (
    <span
      className={`
        rounded border px-2 py-1
        text-[10px] font-medium uppercase
        tracking-wide
        ${styles[status]}
      `}
    >
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function shortenAddress(
  address: string,
): string {
  if (address.length < 12) {
    return address;
  }

  return (
    address.slice(0, 6) +
    '...' +
    address.slice(-4)
  );
}

function formatTimestamp(
  timestamp: number,
): string {
  try {
    return new Date(timestamp)
      .toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
  } catch {
    return '--:--';
  }
}