/**
 * Chain identifier type - matches config/utils/utils.ts Chain type exactly
 */
export type Chain = "sepolia" | "mainnet" | "slot" | "slottest" | "local";

/**
 * Represents a world discovered from the factory contract
 */
export interface FactoryWorld {
  name: string;
  chain: Chain;
}

/**
 * Reference to a world for availability checking
 */
export interface WorldRef {
  name: string;
  chain?: string;
}

/**
 * Metadata about a world's configuration (from Torii SQL)
 */
export interface WorldConfigMeta {
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
}

/**
 * Full availability status for a world
 */
export interface WorldAvailability {
  worldKey: string;
  worldName: string;
  chain?: string;
  isAvailable: boolean;
  meta: WorldConfigMeta | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Row returned from factory SQL query for contracts
 */
export interface FactoryContractRow {
  contract_address: string;
  contract_selector: string;
  name?: string;
}

/**
 * Complete world profile with all resolved data
 */
export interface WorldProfile {
  name: string;
  chain: Chain;
  toriiBaseUrl: string;
  rpcUrl?: string;
  worldAddress: string;
  contractsBySelector: Record<string, string>;
  fetchedAt: number;
}

/**
 * Map of world profiles keyed by world name
 */
export interface WorldProfilesMap {
  [name: string]: WorldProfile;
}

/**
 * Game selection state for Zustand store
 */
export interface GameSelectionState {
  selectedWorld: FactoryWorld | null;
  selectedChain: Chain;

  // Actions
  selectWorld: (world: FactoryWorld) => void;
  setSelectedChain: (chain: Chain) => void;
  clearSelection: () => void;
}
