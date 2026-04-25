import { generateZkProof } from '../src/lib/zkp';
import { payWithZk } from '../src/lib/stellar';

async function main() {
  const NIM_SECRET = "2410010454"; // Ganti dengan NIM kamu
  const WHITELIST = ["2410010454", "2410010001"];
  const DESTINATION = "G... (Alamat Wallet Hotel)";
  const AMOUNT = BigInt(10000000); // 1 USDC (7 decimal)

  try {
    console.log("🛠️  Generating Proof in Terminal...");
    const proof = await generateZkProof(NIM_SECRET, WHITELIST);
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