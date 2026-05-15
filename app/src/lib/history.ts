'use client';

/**
 * history.ts
 *
 * Local transaction persistence layer.
 *
 * Features:
 * - IndexedDB storage
 * - SSR-safe
 * - Browser-safe
 * - Strict TypeScript-safe
 * - Atomic transaction updates
 * - Max history eviction
 * - No external dependency
 *
 * SECURITY:
 * - No secrets stored
 * - No proof internals stored
 * - Only public transaction metadata
 */

export type TxStatus =
    | 'pending'
    | 'success'
    | 'failed';

export interface TxRecord {
    id: string;
    txHash: string;
    amount: string;
    recipient: string;
    timestamp: number;
    status: TxStatus;
    explorerUrl: string;
    errorCode?: string;
}

const DB_NAME = 'fluppy-history-v1';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';
const MAX_HISTORY_SIZE = 50;

// ─────────────────────────────────────────────────────────────
// DATABASE HELPERS
// ─────────────────────────────────────────────────────────────

function isBrowser(): boolean {
    return typeof window !== 'undefined';
}

async function openDb(): Promise<IDBDatabase> {
    if (!isBrowser()) {
        throw new Error('[history] IndexedDB unavailable during SSR');
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(
            DB_NAME,
            DB_VERSION,
        );

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(
                    STORE_NAME,
                    { keyPath: 'id' },
                );

                store.createIndex(
                    'timestamp',
                    'timestamp',
                    { unique: false },
                );
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

function promisifyRequest<T>(
    request: IDBRequest<T>,
): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Creates a new pending transaction record.
 */
export async function createPendingTx(
    record: TxRecord,
): Promise<void> {
    const db = await openDb();

    const existing = await getTxHistory();

    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
            STORE_NAME,
            'readwrite',
        );

        const store = tx.objectStore(STORE_NAME);

        // Evict oldest record if limit exceeded
        if (existing.length >= MAX_HISTORY_SIZE) {
            const oldest = existing.at(-1);

            if (oldest) {
                store.delete(oldest.id);
            }
        }

        store.put(record);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    db.close();
}

/**
 * Returns transaction history sorted newest-first.
 */
export async function getTxHistory(): Promise<TxRecord[]> {
    const db = await openDb();

    const records = await new Promise<TxRecord[]>(
        (resolve, reject) => {
            const tx = db.transaction(
                STORE_NAME,
                'readonly',
            );

            const store = tx.objectStore(STORE_NAME);

            const index = store.index('timestamp');

            const request = index.openCursor(
                null,
                'prev',
            );

            const results: TxRecord[] = [];

            request.onsuccess = () => {
                const cursor = request.result;

                if (cursor) {
                    results.push(
                        cursor.value as TxRecord,
                    );

                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        },
    );

    db.close();

    return records;
}

/**
 * Updates an existing transaction atomically.
 */
export async function updateTxRecord(
    id: string,
    updates: Partial<TxRecord>,
): Promise<void> {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
            STORE_NAME,
            'readwrite',
        );

        const store = tx.objectStore(STORE_NAME);

        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const existing =
                getRequest.result as TxRecord | undefined;

            if (!existing) {
                resolve();
                return;
            }

            const updated: TxRecord = {
                ...existing,
                ...updates,
            };

            store.put(updated);
        };

        tx.oncomplete = () => resolve();

        tx.onerror = () => reject(tx.error);
    });

    db.close();
}

/**
 * Removes all local history.
 */
export async function clearTxHistory(): Promise<void> {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
            STORE_NAME,
            'readwrite',
        );

        tx.objectStore(STORE_NAME).clear();

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    db.close();
}

/**
 * Generates unique transaction ID.
 */
export function generateTxId(): string {
    const bytes = crypto.getRandomValues(
        new Uint8Array(8),
    );

    return (
        'tx_' +
        Array.from(bytes)
            .map(byte =>
                byte
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join('')
    );
}

/**
 * Builds Stellar Expert explorer URL.
 */
export function buildExplorerUrl(
    txHash: string,
    network: 'testnet' | 'mainnet' = 'testnet',
): string {
    const base =
        network === 'mainnet'
            ? 'https://stellar.expert/explorer/public/tx'
            : 'https://stellar.expert/explorer/testnet/tx';

    return `${base}/${txHash}`;
}

export async function finalizeTxHistory(
    id: string,
    txHash: string,
): Promise<void> {
    const db = await openDb();

    const existing = await getTxHistory();

    const record = existing.find(
        item => item.id === id,
    );

    if (!record) {
        return;
    }

    const updated: TxRecord = {
        ...record,
        txHash,
        status: 'success',
        explorerUrl: buildExplorerUrl(txHash),
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction(
            STORE_NAME,
            'readwrite',
        );

        const store = tx.objectStore(STORE_NAME);

        store.put(updated);

        tx.oncomplete = () => resolve();

        tx.onerror = () => reject(tx.error);
    });
}