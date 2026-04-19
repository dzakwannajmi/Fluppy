import { MerkleTree } from 'merkletreejs';
import CryptoJS from 'crypto-js';
import { Buffer } from "buffer";

/**
 * sha256 Cryptographic Hash Function
 * * This helper ensures that hashing remains consistent across the frontend (JavaScript)
 * and the smart contract (Rust/SHA-256).
 */
export const sha256 = (data: Buffer | string): Buffer => {
  const content = Buffer.isBuffer(data) ? data.toString('hex') : Buffer.from(data).toString('hex');
  const hash = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(content));
  return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
};

/**
 * Authorized Member Whitelist
 * * In a production environment, this list would be managed via a secure database
 * or a decentralized identity (DID) registry.
 */
const WHITELIST = ["2410010454", "2410010001", "2410010002"];

// Generate hashed leaves for the Merkle Tree
const leaves = WHITELIST.map(id => sha256(Buffer.from(id)));

/**
 * Merkle Tree Initialization
 * * We use 'sortPairs: true' to enforce a Canonical Merkle Tree structure.
 * This ensures that the generated Proof Path is deterministic and matches 
 * the verification logic in the Soroban Smart Contract.
 */
const tree = new MerkleTree(leaves, sha256, { sortPairs: true });

// Returns the Root Hash (the "Anchor") that is stored or verified on-chain.
export const getMerkleRoot = () => tree.getHexRoot().replace('0x', '');

/**
 * generateZKP (Zero-Knowledge Proof Generator)
 * * This is the core "Privacy-First" function:
 * 1. It takes a sensitive identifier (e.g., NIM/Student ID).
 * 2. It hashes the identifier locally (Client-Side) to create a Leaf.
 * 3. It generates a Merkle Proof Path.
 * * THe secret ID never leaves the user's browser. Only the Proof is sent to the blockchain.
 */
export const generateZKP = (nim: string) => {
  const leaf = sha256(Buffer.from(nim));
  const proof = tree.getProof(leaf);

  // Return the Leaf, the Path (Proof), and the Root to be verified by the contract.
  return {
    leaf,
    proof: proof.map(p => p.data),
    root: Buffer.from(getMerkleRoot(), 'hex')
  };
};