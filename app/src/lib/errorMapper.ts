export const parseContractError = (error: any): string => {
  const errorString = error?.toString() || "";

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

  // Fallback for unknown errors
  console.error("Unknown Error Structure:", error);
  return "Unexpected Error: Please check your connection or try again later.";
};