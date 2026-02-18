export interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
  name?: string;
}

export interface WorldProfile {
  name: string;
  chain: "sepolia" | "mainnet" | "slot" | "slottest" | "local";
  toriiBaseUrl: string;
  rpcUrl?: string;
  worldAddress: string;
  contractsBySelector: Record<string, string>;
  entryTokenAddress?: string;
  feeTokenAddress?: string;
  fetchedAt: number;
}
