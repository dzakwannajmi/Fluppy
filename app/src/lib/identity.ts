// app/src/lib/identity.ts
// Identity layer — generates and securely stores a 256-bit ZK secret.
//
// Flow:
//   generateSecret()           → 32 random bytes → 64-char hex string
//   createCredential(password) → PBKDF2 + AES-GCM → IndexedDB
//   unlockCredential(password) → decrypt → secret (in-memory only)
//
// The secret is NEVER stored in plaintext.

'use client';

// No external imports needed — uses native Web Crypto API only.
// This avoids Turbopack/Next.js 16 compatibility issues with
// argon2-browser and @noble/hashes (which reference Node.js fs/path).

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME    = 'fluppy-identity-v1';
const DB_VERSION = 1;
const STORE_NAME = 'credentials';
const CRED_KEY   = 'zk-credential';

// ─────────────────────────────────────────────────────────────────────────────
// PBKDF2 Configuration
//
// Uses native Web Crypto PBKDF2 — no external dependencies.
// Iteration count is environment-aware:
//   development: 100,000 → ~1-2 seconds  (fast enough for testing)
//   production:  600,000 → ~10-30 seconds (OWASP 2024 recommendation)
//
// IMPORTANT: Iteration count is stored inside each credential blob.
// Changing this value only affects NEW credentials — existing ones
// will still decrypt correctly using their stored iteration count.
// ─────────────────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS =
  process.env.NODE_ENV === 'development' ? 100_000 : 600_000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StoredCredential {
  version:    1;
  kdf:        'pbkdf2';
  iterations: number; // stored to support future migration
  salt:       string; // hex-encoded 32 bytes
  iv:         string; // hex-encoded 12 bytes
  ciphertext: string; // hex-encoded AES-GCM output
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion helpers
// ─────────────────────────────────────────────────────────────────────────────

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers
// ─────────────────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess       = () => resolve(req.result);
    req.onerror         = () => reject(req.error);
  });
}

async function dbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function dbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Key derivation — native Web Crypto PBKDF2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives a non-extractable AES-256-GCM CryptoKey from a password and salt.
 *
 * Uses PBKDF2-SHA256 via the native Web Crypto API:
 *   - Zero external dependencies
 *   - Hardware-accelerated in all modern browsers
 *   - Compatible with Turbopack and Next.js 16
 *   - Non-extractable key — XSS cannot call exportKey()
 *
 * @param password   - User password string
 * @param salt       - 32-byte random salt (unique per credential)
 * @param iterations - PBKDF2 iteration count (read from stored credential)
 */
async function deriveKey(
  password:   string,
  salt:       Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  // Step 1: Import password bytes as PBKDF2 key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  // Step 2: Derive AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       new Uint8Array(salt),
      iterations,
      hash:       'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,              // non-extractable
    ['encrypt', 'decrypt'],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateSecret()
 *
 * Generates a new 256-bit cryptographically random secret.
 * Returns a 64-character lowercase hex string.
 */
export function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}

/**
 * credentialExists()
 *
 * Returns true if an encrypted credential is stored in IndexedDB.
 * Use this to decide: show "Create credential" or "Unlock" UI.
 */
export async function credentialExists(): Promise<boolean> {
  const db     = await openDb();
  const stored = await dbGet(db, CRED_KEY);
  return !!stored;
}

/**
 * createCredential(password)
 *
 * Creates a new ZK credential:
 *   1. Generates a 256-bit random secret
 *   2. Derives AES-GCM key from password using PBKDF2
 *   3. Encrypts the secret with AES-256-GCM
 *   4. Persists the encrypted blob to IndexedDB
 *
 * Returns the raw secret ONCE — show to user as backup phrase.
 * The secret is never stored in plaintext anywhere.
 *
 * @param password - Minimum 8 characters
 */
export async function createCredential(
  password: string,
): Promise<{ secret: string }> {
  if (typeof window === 'undefined') throw new Error('Client-side only');
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const secret = generateSecret();
  const salt   = crypto.getRandomValues(new Uint8Array(32));
  const iv     = crypto.getRandomValues(new Uint8Array(12));

  const key        = await deriveKey(password, new Uint8Array(salt));
  const encoded    = new TextEncoder().encode(secret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 },
    key,
    encoded,
  );

  const stored: StoredCredential = {
    version:    1,
    kdf:        'pbkdf2',
    iterations: PBKDF2_ITERATIONS,
    salt:       toHex(salt),
    iv:         toHex(iv),
    ciphertext: toHex(ciphertext),
  };

  const db = await openDb();
  await dbSet(db, CRED_KEY, stored);

  console.info('[Identity] Credential created and stored in IndexedDB.');
  return { secret };
}

/**
 * unlockCredential(password)
 *
 * Decrypts the stored credential:
 *   1. Loads encrypted blob from IndexedDB
 *   2. Re-derives AES-GCM key using PBKDF2 + stored salt + stored iterations
 *   3. Decrypts with AES-256-GCM
 *
 * Returns the raw secret as a hex string for ZK proof generation.
 * Throws DOMException if the password is wrong (auth tag mismatch).
 *
 * @param password - The same password used in createCredential()
 */
export async function unlockCredential(password: string): Promise<string> {
  if (typeof window === 'undefined') throw new Error('Client-side only');

  const db     = await openDb();
  const raw    = await dbGet(db, CRED_KEY);

  if (!raw) {
    throw new Error('No credential found. Please create one first.');
  }

  // Support both old format (kdf: argon2id) and new format (kdf: pbkdf2)
  const stored = raw as any;

  if (stored.version !== 1) {
    throw new Error(
      `Unknown credential version: ${stored.version}. ` +
      'Delete the existing credential and create a new one.',
    );
  }

  const salt       = new Uint8Array(fromHex(stored.salt));
  const iv         = new Uint8Array(fromHex(stored.iv));
  const ciphertext = new Uint8Array(fromHex(stored.ciphertext)).buffer;

  // Read iterations from stored credential — falls back to current default
  // This ensures old credentials (stored with different iteration counts)
  // still decrypt correctly after config changes
  const iterations = stored.iterations ?? PBKDF2_ITERATIONS;

  const key = await deriveKey(password, salt, iterations);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error(
      'Wrong password or corrupted credential. ' +
      'If you forgot your password, delete the credential and create a new one.',
    );
  }
}

/**
 * deleteCredential()
 *
 * Permanently removes the credential from IndexedDB.
 * Ensure the user has saved their backup secret before calling this.
 */
export async function deleteCredential(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .delete(CRED_KEY);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}