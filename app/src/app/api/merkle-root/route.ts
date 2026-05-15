import { NextResponse } from 'next/server';

import {
  Account,
  Contract,
  Networks,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT
// ─────────────────────────────────────────────────────────────

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL;

const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID;

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

if (!RPC_URL) {
  throw new Error(
    'NEXT_PUBLIC_RPC_URL is not configured',
  );
}

if (!CONTRACT_ID) {
  throw new Error(
    'NEXT_PUBLIC_CONTRACT_ID is not configured',
  );
}

if (!NETWORK_PASSPHRASE) {
  throw new Error(
    'NEXT_PUBLIC_NETWORK_PASSPHRASE is not configured',
  );
}

// ─────────────────────────────────────────────────────────────
// RPC SERVER
// ─────────────────────────────────────────────────────────────

const server = new rpc.Server(RPC_URL);

// ─────────────────────────────────────────────────────────────
// GET /api/merkle-root
// ─────────────────────────────────────────────────────────────

export async function GET() {
  try {

    // ── Dummy read-only source account ───────────────────────

    const sourceAccount =
      new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0',
      );

    // ── Contract call operation ──────────────────────────────

    const contract = new Contract(CONTRACT_ID!);

    const operation =
      contract.call(
        'get_merkle_root',
      );

    // ── Build read-only simulation transaction ───────────────

    const transaction =
      new TransactionBuilder(
        sourceAccount,
        {
          fee: '100',
          networkPassphrase: NETWORK_PASSPHRASE,
        },
      )
        .addOperation(operation)
        .setTimeout(30)
        .build();

    // ── Simulate against Soroban RPC ─────────────────────────

    const response =
      await server.simulateTransaction(
        transaction,
      );

    if (rpc.Api.isSimulationError(response)) {
      throw new Error(response.error);
    }

    const result = response.result?.retval;

    if (!result) {
      throw new Error(
        'Contract returned no value for get_merkle_root',
      );
    }

    // ── Convert ScVal → hex string ───────────────────────────
    //
    // The contract returns BytesN<32> (raw 32-byte big-endian scalar).
    // scValToNative() deserialises this as a Buffer / Uint8Array, not a
    // bigint — so we must branch on the actual runtime type.
    //
    // Expected output: 64-character lowercase hex string (zero-padded).

    const native = scValToNative(result as xdr.ScVal);

    let root: string;

    if (
      native instanceof Uint8Array ||
      Buffer.isBuffer(native)
    ) {
      // BytesN<32> path — most common for Fluppy get_merkle_root
      root = Buffer.from(native)
        .toString('hex')
        .padStart(64, '0');
    } else if (typeof native === 'bigint') {
      // Fallback: contract returns u256 / i256 scalar
      root = native
        .toString(16)
        .padStart(64, '0');
    } else {
      root = String(native);
    }

    return NextResponse.json(
      { root },
      { status: 200 },
    );

  } catch (err) {

    console.error('[API] merkle-root error:', err);

    return NextResponse.json(
      { error: 'Failed to fetch contract Merkle root' },
      { status: 500 },
    );
  }
}