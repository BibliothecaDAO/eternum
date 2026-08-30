import type { GameChain as Chain } from "@realms-world/chain";

export interface GameProfile {
  name: string; // human-readable game name (e.g., s2smoke1) — profile identity key
  chain: Chain;
  worldId?: string; // world-directory key ("blitz" | "eternum") the game lives in
  namespace?: string; // the world's model namespace; absent on stale stored profiles -> derived from chain
  heraldBaseUrl: string; // shared persistent-world Herald endpoint
  rpcUrl?: string; // configured chain RPC
  worldAddress: string; // persistent s2 world from the manifest
  contractsBySelector: Record<string, string>; // normalized selector -> address (constant per world)
  playerAccountClassHash?: string;
  playerRegistryAddress?: string;
  bindingAuthorityAddress?: string;
  gameId?: number; // s2 single-world: the game's id — key[0] of every per-game model
  presetId?: number; // s2 single-world: rulebook preset the game runs on
  fetchedAt: number; // epoch ms
}

// Transitional alias — legacy call sites migrate to GameProfile over A4.
export type WorldProfile = GameProfile;

export interface WorldProfilesMap {
  [name: string]: WorldProfile;
}
