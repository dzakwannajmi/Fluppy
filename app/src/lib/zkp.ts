'use client';

import { Buffer } from "buffer";
// @ts-ignore
import { poseidon1, poseidon2 } from 'poseidon-lite';

export interface ZKProof {
  g1_points: { x: Buffer; y: Buffer }[];
  g2_points: { x: { a: Buffer; b: Buffer }; y: { a: Buffer; b: Buffer } }[];
  public_inputs: string[];
}

let globalBackend: any = null;
let globalNoir: any = null;
let cachedCircuit: any = null;

/**
 * ✅ Load circuit dari /public (AMAN dari bundler)
 */
async function loadCircuit() {
  if (cachedCircuit) return cachedCircuit;

  const res = await fetch('/circuit.json', {
    cache: 'no-store',
  });

  const json = await res.json();

  // 🔥 ambil bytecode dulu
  const bytecode =
    json?.bytecode ??
    json?.program?.bytecode;

  if (!bytecode || typeof bytecode !== 'string') {
    console.error("❌ Invalid circuit.json:", json);
    throw new Error("Invalid circuit.json: missing bytecode");
  }

  // ✅ DEBUG di sini (baru valid)
  console.log("📦 BYTECODE LENGTH (browser):", bytecode.length);
  console.log("📦 BYTECODE START:", bytecode.slice(0, 30));
  console.log("📦 BYTECODE END:", bytecode.slice(-30));

  cachedCircuit = {
    bytecode,
    abi: json.abi,
  };

  return cachedCircuit;
}

export const generateZkProof = async (
  secretId: string,
  whitelist: string[]
): Promise<ZKProof> => {

  if (typeof window === 'undefined') {
    throw new Error('Client-side only');
  }

  try {
    const circuitData = await loadCircuit();

    if (!globalBackend || !globalNoir) {
      console.log("🔄 [ZKP] Initializing Prover Engine...");

      const { BarretenbergBackend } = await import('@noir-lang/backend_barretenberg');
      const { Noir } = await import('@noir-lang/noir_js');

      globalBackend = new BarretenbergBackend(circuitData);
      globalNoir = new Noir(circuitData);

      console.log("✅ [ZKP] Backend & Noir ready.");
    }

    // 🔐 Poseidon hashing
    const hashedLeaves = whitelist.map(id =>
      poseidon1([BigInt(id)]).toString()
    );

    const leafToProve = poseidon1([BigInt(secretId)]).toString();

    const { index, hashPath } = calculateMerklePath(
      leafToProve,
      hashedLeaves,
      10
    );

    const input = {
      secret_id: secretId.toString(),
      index: index.toString(),
      hash_path: hashPath.map(h => h.toString()),
    };

    console.log("🔧 [ZKP] Executing circuit...");
    const { witness, returnValue } = await globalNoir.execute(input);

    console.log("🎨 [ZKP] Generating proof...");
    const { proof } = await globalBackend.generateProof(witness);

    console.log("✅ [ZKP] Proof generated!");

    return {
      ...parseProofToAffinePoints(proof),
      public_inputs: [returnValue.toString()],
    };

  } catch (error: any) {
    console.error("❌ [ZKP] Error Detail:", error);

    // reset state supaya retry bersih
    globalBackend = null;
    globalNoir = null;
    cachedCircuit = null;

    throw error;
  }
};

function calculateMerklePath(
  leaf: string,
  allLeaves: string[],
  depth: number
) {
  let index = allLeaves.indexOf(leaf);
  if (index === -1) {
    throw new Error("Identifier not found in whitelist.");
  }

  let currentLevel = allLeaves;
  const path: string[] = [];
  let tempIndex = index;

  for (let i = 0; i < depth; i++) {
    const isRight = tempIndex % 2 === 1;
    const siblingIndex = isRight ? tempIndex - 1 : tempIndex + 1;
    const sibling = currentLevel[siblingIndex] || "0";

    path.push(sibling);

    const nextLevel = [];
    for (let j = 0; j < currentLevel.length; j += 2) {
      const left = currentLevel[j];
      const right = currentLevel[j + 1] || "0";

      nextLevel.push(
        poseidon2([BigInt(left), BigInt(right)]).toString()
      );
    }

    currentLevel = nextLevel;
    tempIndex = Math.floor(tempIndex / 2);
  }

  return { index, hashPath: path };
}

function parseProofToAffinePoints(proof: Uint8Array) {
  return {
    g1_points: [{
      x: Buffer.from(proof.slice(0, 32)),
      y: Buffer.from(proof.slice(32, 64)),
    }],
    g2_points: [{
      x: {
        a: Buffer.from(proof.slice(64, 96)),
        b: Buffer.from(proof.slice(96, 128)),
      },
      y: {
        a: Buffer.from(proof.slice(128, 160)),
        b: Buffer.from(proof.slice(160, 192)),
      },
    }],
  };
}