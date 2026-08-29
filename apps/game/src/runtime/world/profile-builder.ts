import type { GameChain } from "@realms-world/chain";

import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { resolveWorldIdForGame } from "./game-registry";
import { fetchHeraldGameDirectory } from "./herald-http";
import { normalizeRpcUrl } from "./normalize";
import { saveWorldProfile } from "./store";
import type { GameProfile, WorldProfile } from "./types";
import { getDefaultWorld, getWorldById } from "./world-directory";

const measureAsyncDuration = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    recordGameEntryDuration(name, performance.now() - startedAt);
  }
};

export const buildWorldProfile = async (chain: GameChain, name: string, worldId?: string): Promise<WorldProfile> => {
  const resolvedWorldId = worldId ?? (await resolveWorldIdForGame(name));
  const world = getWorldById(resolvedWorldId) ?? getDefaultWorld();
  if (world.chain !== chain) {
    throw new Error(`Game "${name}" is not deployed on ${chain}`);
  }

  const directory = await measureAsyncDuration("game-profile-directory-fetch", async () =>
    fetchHeraldGameDirectory(world),
  );
  const game = directory.games.find((candidate) => candidate.name === name);
  if (!game) {
    throw new Error(`Game "${name}" not found in the ${world.id} world's GameRegistry`);
  }
  if (!directory.chain_config) throw new Error(`Herald directory for ${world.id} has no ChainConfig`);

  const profile: GameProfile = {
    name,
    chain,
    worldId: world.id,
    namespace: world.namespace,
    heraldBaseUrl: world.heraldBaseUrl,
    rpcUrl: normalizeRpcUrl(world.rpcUrl),
    worldAddress: world.worldAddress,
    contractsBySelector: world.contractsBySelector,
    playerAccountClassHash: world.playerAccountClassHash,
    playerRegistryAddress: world.playerRegistryAddress,
    bindingAuthorityAddress: world.bindingAuthorityAddress,
    entryTokenAddress: directory.chain_config.entry_token_address ?? undefined,
    feeTokenAddress: directory.chain_config.fee_token_address ?? undefined,
    gameId: game.game_id,
    presetId: game.preset_id,
    fetchedAt: Date.now(),
  };
  saveWorldProfile(profile);
  return profile;
};
