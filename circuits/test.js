const { buildPoseidon } = require("circomlibjs");
const fs = require("fs");

async function generateValidInput() {
    // 1. Initialize Poseidon Hash
    const poseidon = await buildPoseidon();
    const F = poseidon.F; // Field Math (BN254)

    console.log("🛠 Calculating mathematical parameters for ZK...");

    // 2. Define Dummy Data
    const secret = 123;
    const nonce = 456;
    const amount = 1000;
    const recipientHash = 101;
    const minAmount = 100;
    const maxAmount = 10000;

    // 3. Calculate Leaf Hash 
    // MATCHING CIRCOM LOGIC: Poseidon(secret, amount, recipientHash)
    const leaf = poseidon([secret, amount, recipientHash]);

    // 4. Calculate Merkle Root (Depth 20) with empty path (all 0s)
    const levels = 20;
    let currentHash = leaf;
    let pathElements = [];
    let pathIndices = [];

    for (let i = 0; i < levels; i++) {
        pathElements.push(0); // Sibling node is 0
        pathIndices.push(0);  // 0 means we are at the "left" position

        // Hash current node with its sibling
        currentHash = poseidon([currentHash, 0]);
    }

    // Convert final result to decimal string format
    const merkleRootStr = F.toString(currentHash);

    // 5. Structure JSON input format matching Circom variable names
    const validInputs = {
        secret: secret.toString(),
        nonce: nonce.toString(),
        amount: amount.toString(),
        pathElements: pathElements.map(x => x.toString()),
        pathIndices: pathIndices,
        merkleRoot: merkleRootStr,
        recipientHash: recipientHash.toString(),
        minAmount: minAmount.toString(),
        maxAmount: maxAmount.toString()
    };

    // 6. Save to input.json
    fs.writeFileSync("input.json", JSON.stringify(validInputs, null, 2));
    
    console.log("✅ File input.json generated successfully!");
    console.log("🌲 Real Merkle Root: ", merkleRootStr);
}

generateValidInput().catch(err => {
    console.error("Error:", err);
});