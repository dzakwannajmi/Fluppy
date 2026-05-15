import { generateSecret } from '../src/lib/identity';
import { getMerkleProof } from '../src/lib/merkle';
import { generateZkProof } from '../src/lib/zkp';
import { payWithZkGroth16 } from '../src/lib/stellar';

import * as snarkjs from 'snarkjs';
import * as path from 'path';

async function main() {
  // Use a secret that is already enrolled in MOCK_WHITELIST_SECRETS
  const SECRET = generateSecret();
  const DESTINATION = 'G... (Merchant Wallet Address)';
  const AMOUNT = BigInt(10_000_000); // 1 USDC (7 decimal places)

  // In Node.js, snarkjs.groth16.fullProve() accepts file paths directly
  const WASM_PATH = path.resolve(__dirname, '../public/circuit.wasm');
  const ZKEY_PATH = path.resolve(__dirname, '../public/circuit_final.zkey');

  console.log(`[Test] Secret: ${SECRET.slice(0, 8)}...`);

  try {
    console.log('[Test] Fetching Merkle proof...');
    const merkleProof = await getMerkleProof(SECRET);
    console.log('[Test] Root:', merkleProof.root.toString().slice(0, 20) + '...');

    console.log('[Test] Generating Groth16 proof via SnarkJS...');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        secret: BigInt(`0x${SECRET}`).toString(),
        pathElements: merkleProof.pathElements.map(e => e.toString()),
        pathIndices: merkleProof.pathIndices.map(i => i.toString()),
        root: merkleProof.root.toString(),
      },
      WASM_PATH,
      ZKEY_PATH
    );
    console.log('[Test] Proof generated. Public signals:', publicSignals);

    console.log('[Test] Verifying proof locally...');
    const vKey = require('../public/verification_key.json');
    const valid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    if (!valid) throw new Error('Proof invalid — check circuit inputs');
    console.log('[Test] ✓ Proof valid');

    console.log('[Test] Submitting to Stellar Testnet...');
    const zkProof = await generateZkProof(
      SECRET,
      merkleProof,
      DESTINATION,
      AMOUNT,
    );
    const result = await payWithZkGroth16(
      DESTINATION,
      AMOUNT,
      zkProof,
    ) as any;

    console.log('✅ SUCCESS');
    console.log('Tx Hash:', result.hash);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

main();