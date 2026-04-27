import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { generateZkProof } from '../src/lib/zkp';
import { payWithZk } from '../src/lib/stellar';

async function main() {
  const NIM_SECRET = "2410010454";
  const WHITELIST = ["2410010454", "2410010001"];
  const DESTINATION = "GDLST72TGNYOET54VCY7A63FKWHVUWPFAOOKJKCURI3VQXXLWWE7CLSF";
  const AMOUNT = BigInt(10000000);

  try {
    console.log("🛠️  Generating Proof in Terminal...");
    const proof = await generateZkProof(NIM_SECRET, WHITELIST, DESTINATION, AMOUNT);
    console.log("✅ Proof Generated!");

    console.log("🚀 Submitting to Stellar Testnet...");
    const result = await payWithZk(DESTINATION, AMOUNT, proof);

    console.log("🎉 SUCCESS!");
    console.log("Tx Hash:", result.hash);
  } catch (error) {
    console.error("❌ Failed:", error);
  }
}

main();