import { MerkleTree } from 'merkletreejs';
import CryptoJS from 'crypto-js';
import { Buffer } from "buffer";

export const sha256 = (data: Buffer | string): Buffer => {
  const content = Buffer.isBuffer(data) ? data.toString('hex') : Buffer.from(data).toString('hex');
  const hash = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(content));
  return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
};

const WHITELIST = ["2410010454", "2410010001", "2410010002"];
const leaves = WHITELIST.map(id => sha256(Buffer.from(id)));
const tree = new MerkleTree(leaves, sha256, { sortPairs: true });

export const getMerkleRoot = () => tree.getHexRoot().replace('0x', '');

export const generateZKP = (nim: string) => {
  const leaf = sha256(Buffer.from(nim));
  const proof = tree.getProof(leaf);
  return { leaf, proof: proof.map(p => p.data), root: Buffer.from(getMerkleRoot(), 'hex') };
};