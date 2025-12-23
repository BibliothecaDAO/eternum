export type Chain = "sepolia" | "mainnet" | "slot" | "slottest" | "local";

export interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
  name?: string;
}

export interface WorldProfile {
  name: string;
  chain: Chain;
  toriiBaseUrl: string;
  worldAddress: string;
  contractsBySelector: Record<string, string>;
  fetchedAt: number;
}

export interface WorldProfilesMap {
  [name: string]: WorldProfile;
}
