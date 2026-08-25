import type { Chain } from "@contracts";

export interface FactoryContractRow {
  contract_address: string;
  contract_selector: string; // hex string (may be shorter or left-padded)
  name?: string; // factory table may include the world name felt
}

export interface GameProfile {
  name: string; // human-readable game name (e.g., s2smoke1) — profile identity key
  chain: Chain;
  worldId?: string; // world-directory key ("blitz" | "eternum") the game lives in
  namespace?: string; // the world's model namespace; absent on stale stored profiles -> derived from chain
  toriiBaseUrl: string; // appchain: constant torii-s2 endpoint; mainnet: per-world torii
  rpcUrl?: string; // appchain: constant chain rpc; mainnet: resolved from factory
  worldAddress: string; // appchain: constant s2 world from the manifest
  contractsBySelector: Record<string, string>; // normalized selector -> address (constant on appchain)
  entryTokenAddress?: string; // appchain: ChainConfig.entry_token_address (chain-wide shared collection)
  feeTokenAddress?: string; // appchain: ChainConfig.fee_token
  gameId?: number; // s2 single-world: the game's id — key[0] of every per-game model
  presetId?: number; // s2 single-world: rulebook preset the game runs on
  fetchedAt: number; // epoch ms
}

// Transitional alias — legacy call sites migrate to GameProfile over A4.
export type WorldProfile = GameProfile;

export interface FactoryIndexedWorld {
  name: string;
  chain: Chain;
  worldAddress: string | null;
}

export interface WorldProfilesMap {
  [name: string]: WorldProfile;
}
