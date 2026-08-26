import { SqlApi } from "@bibliothecadao/torii";
import type { GameChain } from "@realms-world/chain";

import { appchainModel } from "@/dojo/game-scope";
import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { fetchS2GameRow, resolveWorldIdForGame } from "./game-registry";
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

const normalizeAddress = (address: unknown): string | null => {
  if (address == null) return null;
  if (typeof address === "string") {
    try {
      return BigInt(address) === 0n ? null : address;
    } catch {
      return address;
    }
  }
  if (typeof address === "bigint") return address === 0n ? null : `0x${address.toString(16)}`;
  return null;
};

const resolveGameChainConfig = async (
  toriiBaseUrl: string,
): Promise<{ entryTokenAddress?: string; feeTokenAddress?: string }> =>
  measureAsyncDuration("game-profile-chain-config-fetch", async () => {
    try {
      const query = `SELECT entry_token_address, fee_token FROM "${appchainModel("ChainConfig")}" LIMIT 1;`;
      const response = await fetch(`${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`);
      if (!response.ok) return {};
      const [row] = (await response.json()) as Record<string, unknown>[];
      return row
        ? {
            entryTokenAddress: normalizeAddress(row.entry_token_address) ?? undefined,
            feeTokenAddress: normalizeAddress(row.fee_token) ?? undefined,
          }
        : {};
    } catch {
      return {};
    }
  });

const resolveWorldAddress = async (toriiBaseUrl: string, committedAddress: string): Promise<string> =>
  measureAsyncDuration("world-profile-world-address-fetch", async () => {
    try {
      const indexedAddress = normalizeAddress(await new SqlApi(`${toriiBaseUrl}/sql`).fetchWorldAddress());
      if (indexedAddress && BigInt(indexedAddress) !== BigInt(committedAddress)) {
        throw new Error("Indexed world address does not match the committed manifest");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not match")) throw error;
    }
    return committedAddress;
  });

export const buildWorldProfile = async (chain: GameChain, name: string, worldId?: string): Promise<WorldProfile> => {
  const resolvedWorldId = worldId ?? (await resolveWorldIdForGame(name));
  const world = getWorldById(resolvedWorldId) ?? getDefaultWorld();
  if (world.chain !== chain) {
    throw new Error(`Game "${name}" is not deployed on ${chain}`);
  }

  const [game, chainConfig, worldAddress] = await Promise.all([
    measureAsyncDuration("game-profile-registry-fetch", async () => fetchS2GameRow(world.toriiBaseUrl, name)),
    resolveGameChainConfig(world.toriiBaseUrl),
    resolveWorldAddress(world.toriiBaseUrl, world.worldAddress),
  ]);
  if (!game) {
    throw new Error(`Game "${name}" not found in the ${world.id} world's GameRegistry`);
  }

  const profile: GameProfile = {
    name,
    chain,
    worldId: world.id,
    namespace: world.namespace,
    toriiBaseUrl: world.toriiBaseUrl,
    rpcUrl: normalizeRpcUrl(world.rpcUrl),
    worldAddress,
    contractsBySelector: world.contractsBySelector,
    playerAccountClassHash: world.playerAccountClassHash,
    playerRegistryAddress: world.playerRegistryAddress,
    bindingAuthorityAddress: world.bindingAuthorityAddress,
    entryTokenAddress: chainConfig.entryTokenAddress,
    feeTokenAddress: chainConfig.feeTokenAddress,
    gameId: game.gameId,
    presetId: game.presetId,
    fetchedAt: Date.now(),
  };
  saveWorldProfile(profile);
  return profile;
};
