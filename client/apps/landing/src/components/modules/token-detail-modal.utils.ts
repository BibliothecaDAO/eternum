export function getActiveOrderLookupAddress(token: { contract_address?: string | null }): string {
  if (!token.contract_address) {
    throw new Error("Token contract address is required for active order lookup");
  }
  return token.contract_address;
}
