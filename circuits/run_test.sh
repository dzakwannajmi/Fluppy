#!/bin/bash

# 1. Create a timestamp (e.g., 20260426_193000)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SNAPSHOT_DIR="test_snapshots/test/run_$TIMESTAMP"

echo "==================================================="
echo "🚀 Starting ZK Sanity Check & Snapshot Automation"
echo "📂 Output Directory: $SNAPSHOT_DIR"
echo "==================================================="

# 2. Create the snapshot directory
mkdir -p "$SNAPSHOT_DIR"

# 3. Run the Node.js script to generate valid input.json
echo "[1/3] Generating valid input data..."
node test.js | tee "$SNAPSHOT_DIR/01_input_generation_log.txt"

# 4. Generate ZK Proof and save the log
echo "[2/3] Generating ZK Proof (Proving)..."
snarkjs groth16 fullprove input.json ./build/FluppyPayment_js/FluppyPayment.wasm circuit_final.zkey proof.json public.json | tee "$SNAPSHOT_DIR/02_prove_log.txt"

# 5. Verify the Proof and save the log
echo "[3/3] Verifying ZK Proof..."
snarkjs groth16 verify vkey.json public.json proof.json | tee "$SNAPSHOT_DIR/03_verify_log.txt"

# 6. Copy all artifacts to the snapshot folder
echo "📸 Saving artifacts to snapshot..."
cp input.json "$SNAPSHOT_DIR/"
cp proof.json "$SNAPSHOT_DIR/"
cp public.json "$SNAPSHOT_DIR/"

echo "==================================================="
echo "✅ Testing Complete! All evidence securely stored."
echo "==================================================="
