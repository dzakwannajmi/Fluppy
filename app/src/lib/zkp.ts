/**
 * lib/zkp.ts — Fluppy ZKP Proof Generator & Orchestrator
 *
 * This module handles:
 * 1. Merkle Tree computation (Poseidon-based)
 * 2. Identity commitment verification
 * 3. Groth16 Proof generation compatible with Soroban (BN254)
 *
 * @author Fluppy Engineering
 */


import { buildPoseidon } from "circomlibjs";
import path from "path";

import * as snarkjs from "snarkjs";
import { Address, hash } from "@stellar/stellar-sdk";

// --- Configuration & Constants ---
const isBrowser = typeof window !== "undefined";

// const WASM_PATH = "/circuit/fluppy_payment.wasm";
// const ZKEY_PATH = "/circuit/circuit_final.zkey";

const WASM_PATH = isBrowser
  ? "/circuit/fluppy_payment.wasm"
  : path.join(process.cwd(), "public", "circuit", "fluppy_payment.wasm");

const ZKEY_PATH = isBrowser
  ? "/circuit/circuit_final.zkey"
  : path.join(process.cwd(), "public", "circuit", "circuit_final.zkey");


const N_PUBLIC = 6;
const BN254_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// --- Interfaces ---

export interface PaymentProofOutput {
  pi_a: string;
  pi_b: string;
  pi_c: string;
  publicSignals: [string, string, string, string, string, string];
}

// --- Internal Encoding Helpers (Soroban Compatibility) ---

function decimalToBe32Hex(decimal: string): string {
  const n = BigInt(decimal);
  if (n < 0n || n >= 2n ** 256n) throw new RangeError("Invalid field element");
  return n.toString(16).padStart(64, "0");
}

function encodeG1(point: [string, string, string]): string {
  return decimalToBe32Hex(point[0]) + decimalToBe32Hex(point[1]);
}

function encodeG2(point: [[string, string], [string, string], [string, string]]): string {
  return (
    decimalToBe32Hex(point[0][0]) +
    decimalToBe32Hex(point[0][1]) +
    decimalToBe32Hex(point[1][0]) +
    decimalToBe32Hex(point[1][1])
  );
}

// --- Business Logic Helpers ---

/**
 * Computes a simple SHA256-based hash for the recipient address.
 * MUST stay aligned with `hash_address` in payment.rs.
 */
function computeRecipientHash(addressStr: string): bigint {
  const addr = Address.fromString(addressStr);
  const xdrBytes = addr.toScVal().toXDR();
  const hashedBuffer = hash(xdrBytes);

  hashedBuffer[0] = 0; // Ensure the hash is always < BN254_R by zeroing the first byte

  return BigInt("0x" + hashedBuffer.toString("hex"));
}

/**
 * Mock Merkle Tree Generator (Depth 20)
 * REPLACE this with a real Merkle library (e.g., fixed-merkle-tree) in production.
 */
function getMerkleProof(leaf: string, whitelist: string[]) {
  // Simple deterministic mock for hackathon purposes
  // In production, build a real Poseidon Merkle Tree here
  return {
    root: 123456789n, // Example root
    pathElements: new Array(20).fill(0n),
    pathIndices: new Array(20).fill(0),
  };
}

// --- Public API ---

/**
 * Main entry point for the frontend hook.
 * Converts high-level UI inputs into a valid ZK Proof.
 */
export async function generateZkProof(
  nimSecret: string,
  whitelist: string[],
  recipientAddr: string,
  amount: bigint = BigInt(10 * 10 ** 7) // Default to 10 USDC in smallest unit
): Promise<PaymentProofOutput> {
  console.log("ZKP: Orchestrating proof for identity secret...");

  console.log("🕵️‍♂️ [CCTV ZKP] Alamat yang masuk ke ZKP:", recipientAddr);

  const poseidon = await buildPoseidon();


  const F = poseidon.F; // Field helper

  // 1. Prepare Circuit Inputs
  const secretInt = BigInt(nimSecret); // User's NIM/Secret
  const { root } = getMerkleProof(nimSecret, whitelist);

  const recipientHash = computeRecipientHash(recipientAddr);

  console.log("🕵️‍♂️ [CCTV ZKP] Hasil Hash:", recipientHash.toString());

  // Define bounds (e.g., 0 to 1000 USDC)
  const minAmount = 0n;
  const maxAmount = BigInt(1000 * 10 ** 7);

  const leaf = poseidon([secretInt, amount, recipientHash]);

  const pathElements = new Array(20).fill(BigInt(0));
  const pathIndices = new Array(20).fill(0);

  let currentHash = leaf;
  for (let i = 0; i < 20; i++) {
    currentHash = poseidon([currentHash, pathElements[i]]);
  }

  const realRoot = F.toObject(currentHash);

  const circuitInputs = {
    secret: secretInt.toString(),
    nonce: BigInt(Math.floor(Math.random() * 1000000)).toString(),
    amount: amount.toString(),
    pathElements: pathElements.map((x) => x.toString()),
    pathIndices: pathIndices,
    merkleRoot: realRoot.toString(),
    recipientHash: recipientHash.toString(),
    minAmount: minAmount.toString(),
    maxAmount: maxAmount.toString(),
  };

  // 2. Generate Proof via SnarkJS
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInputs,
    WASM_PATH,
    ZKEY_PATH
  );

  // 3. Transform to Soroban-compatible encoding
  const pi_a = encodeG1(proof.pi_a as [string, string, string]);
  const pi_b = encodeG2(proof.pi_b as [[string, string], [string, string], [string, string]]);
  const pi_c = encodeG1(proof.pi_c as [string, string, string]);

  const encodedSignals = publicSignals.map((sig: string) =>
    decimalToBe32Hex(sig)
  ) as [string, string, string, string, string, string];

  return { pi_a, pi_b, pi_c, publicSignals: encodedSignals };
}