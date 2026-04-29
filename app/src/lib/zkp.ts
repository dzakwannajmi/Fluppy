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
  amount: bigint = BigInt(10 * 10 ** 7)
) { // Hapus type : Promise<PaymentProofOutput> sementara jika error, atau biarkan jika sudah ada interface-nya
  console.log("ZKP: Orchestrating proof for identity secret...");

  // 1. Path WASM dan ZKEY yang dijamin aman di Vercel
  const zkeyPath = path.join(process.cwd(), 'public', 'circuit', 'circuit_final.zkey');
  const wasmPath = path.join(process.cwd(), 'public', 'circuit', 'circuit.wasm');

  console.log("🕵️‍♂️ [CCTV ZKP] Alamat yang masuk ke ZKP:", recipientAddr);

  const poseidon = await buildPoseidon();

  // Prepare Circuit Inputs
  const secretInt = BigInt(nimSecret); // User's NIM/Secret
  const { root } = getMerkleProof(nimSecret, whitelist);
  const recipientHash = computeRecipientHash(recipientAddr);

  console.log("🕵️‍♂️ [CCTV ZKP] Hasil Hash:", recipientHash.toString());

  // Define bounds
  const minAmount = 0n;
  const maxAmount = BigInt(1000 * 10 ** 7);

  // -- Bagian perhitungan Merkle Path kamu --
  const leaf = poseidon([secretInt, amount, recipientHash]);
  const pathElements = new Array(20).fill(BigInt(0));
  const pathIndices = new Array(20).fill(0);

  let currentHash = leaf;
  for (let i = 0; i < 20; i++) {
    currentHash = poseidon([currentHash, pathElements[i]]);
  }
  // ------------------------------------------

  // 👇 2. BUNGKUS SEMUA INPUT UNTUK CIRCUIT 👇
  // PENTING: snarkjs lebih suka menerima angka dalam bentuk String agar tidak error BigInt
  const input = {
    secret: secretInt.toString(),
    amount: amount.toString(),
    recipientHash: recipientHash.toString(),
    root: currentHash.toString(), // Atau root.toString() tergantung sirkuitmu
    pathElements: pathElements.map(e => e.toString()),
    pathIndices: pathIndices.map(i => i.toString()),
    minAmount: minAmount.toString(),
    maxAmount: maxAmount.toString()
  };

  console.log("⚙️ Menjalankan snarkjs.groth16.fullProve...");

  // 👇 3. EKSEKUSI PEMBUATAN PROOF 👇
  // Di sinilah wasmPath dan zkeyPath akhirnya digunakan!
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  console.log("✅ ZK Proof berhasil dibuat!");

  return {
    proof,
    publicSignals
  };
}