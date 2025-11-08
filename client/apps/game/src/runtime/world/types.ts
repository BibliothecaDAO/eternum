export interface FactoryContractRow {
  contract_address: string;
  contract_selector: string; // hex string (may be shorter or left-padded)
  name?: string; // factory table may include the world name felt
}

export interface WorldProfile {
  name: string; // human-readable world name (e.g., credenceox-82389)
  chain: "sepolia" | "mainnet" | "slot" | "slottest" | "local";
  toriiBaseUrl: string; // e.g., https://api.cartridge.gg/x/<name>/torii
  worldAddress: string; // resolved from torii /sql
  contractsBySelector: Record<string, string>; // normalized selector -> address
  fetchedAt: number; // epoch ms
}

export interface WorldProfilesMap {
  [name: string]: WorldProfile;
}
