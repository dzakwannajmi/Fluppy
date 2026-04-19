# Fluppy Protocol - Global Orchestrator
# This Makefile manages both the Frontend (Next.js) and Backend (Soroban)

.PHONY: all setup build test fmt deploy clean

# Default target
all: build

# 1. Setup: Prepares the entire workspace (Frontend + Rust toolchain)
setup:
	@echo "🚀 Initializing Global Environment..."
	@echo "--- Installing Frontend Dependencies ---"
	cd app && npm install
	@echo "--- Adding WASM Target ---"
	rustup target add wasm32-unknown-unknown
	@echo "✅ Global setup complete."

# 2. Build: Compiles the smart contract using the Stellar CLI
build:
	@echo "🛠️ Compiling Fluppy Smart Contract..."
	cd contracts && stellar contract build
	@echo "--- Build successful ---"

# 3. Test: Executes the 4/4 passing unit tests in the contracts folder
test:
	@echo "🧪 Running On-Chain Logic Validation..."
	cd contracts && cargo test -- --nocapture
	@echo "✅ All tests passed successfully."

# 4. Format: Standardizes code style for professional auditing
fmt:
	@echo "🎨 Formatting Rust source files..."
	cd contracts && cargo fmt --all
	@echo "✨ Code formatting complete."

# 5. Deploy: Deploys the optimized WASM to Stellar Testnet
# Prerequisites: soroban-cli installed & 'default' identity configured
deploy: build
	@echo "🌐 Deploying to Stellar Testnet..."
	stellar contract deploy \
		--wasm target/wasm32v1-none/release/fluppy.wasm \
		--source-account najmi \
		--network testnet	

# 6. Clean: Wipes build caches and local dependencies
clean:
	@echo "🧹 Cleaning entire workspace..."
	cd contracts && cargo clean
	rm -rf app/.next app/node_modules
	@echo "✨ Workspace is now clean."