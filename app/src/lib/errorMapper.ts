export const parseContractError = (error: unknown): string => {
  const errorString = error instanceof Error ? error.toString() : String(error ?? "");
  const errorMessage = error instanceof Error ? error.message : "";
  const lowered = `${errorString}\n${errorMessage}`.toLowerCase();

  // Mapping based on your Rust 'ContractError' enum
  if (errorString.includes("Error(Contract, #1)")) {
    return "Access Denied: Your identity is not in the authorized whitelist.";
  }
  if (errorString.includes("Error(Contract, #2)")) {
    return "Insufficient Balance: You do not have enough USDC to complete this transaction.";
  }
  if (errorString.includes("Error(Contract, #3)")) {
    return "Protocol Paused: Payments are temporarily disabled by the administrator.";
  }
  if (errorString.includes("Error(WasmVm, InvalidAction)")) {
    return "Security Alert: This contract has already been initialized.";
  }
  if (errorString.includes("User declined the transaction")) {
    return "Transaction Cancelled: You rejected the request in Freighter.";
  }
  if (errorMessage.includes("Identifier not found in whitelist")) {
    return "Access Denied: Your identity is not in the authorized whitelist.";
  }
  if (errorMessage.includes("must contain digits only")) {
    return "Invalid NIM/Secret ID: Use digits only.";
  }
  if (errorMessage.includes("is required")) {
    return "Missing Required Input: Please fill in every required field.";
  }
  if (
    lowered.includes("deserialize_len") ||
    lowered.includes("bincodedeserialize") ||
    lowered.includes("acir_get_circuit_sizes")
  ) {
    return "ZKP Backend Mismatch: The browser loaded an incompatible Noir/Barretenberg circuit runtime. Refresh after reinstalling dependencies so the app uses the backend-compatible bb.js version.";
  }

  // Fallback for unknown errors
  console.error("Unknown Error Structure:", error);
  return "Unexpected Error: Please check your connection or try again later.";
};
