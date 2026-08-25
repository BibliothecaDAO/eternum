import { SqlApi } from "@bibliothecadao/torii";
import { type Chain } from "@contracts";
import { appchainModel } from "@/dojo/game-scope";
import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";

import { env, hasPublicNodeUrl } from "../../../env";
import { getFactorySqlBaseUrl } from "./factory-endpoints";
import { resolveWorldContracts, resolveWorldDeploymentFromFactory } from "./factory-resolver";
import { fetchS2GameRow, resolveAppchainWorldIdForGame } from "./game-registry";
import { isRpcUrlCompatibleForChain, normalizeRpcUrl } from "./normalize";
import { saveWorldProfile } from "./store";
import type { GameProfile, WorldProfile } from "./types";
import { getDefaultWorld, getWorldById } from "./world-directory";

const cartridgeApiBase = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";

const toriiBaseUrlFromName = (name: string) => `${cartridgeApiBase}/x/${name}/torii`;

const measureAsyncDuration = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    recordGameEntryDuration(name, performance.now() - startedAt);
  }
};

const normalizeAddress = (addr: unknown): string | null => {
  if (addr == null) return null;
  // Torii returns padded 66-char hex; treat numeric zero (any padding) as
  // absent so 0x000…0 never leaks into profiles or session policies.
  if (typeof addr === "string") {
    try {
      return BigInt(addr) === 0n ? null : addr;
    } catch {
      return addr;
    }
  }
  if (typeof addr === "bigint") return addr === 0n ? null : "0x" + addr.toString(16);
  return null;
};

const resolveFactoryWorldData = async (
  factorySqlBaseUrl: string,
  chain: Chain,
  name: string,
): Promise<{
  contractsBySelector: Record<string, string>;
  deployment: Awaited<ReturnType<typeof resolveWorldDeploymentFromFactory>>;
}> => {
  const [contractsBySelector, deployment] = await Promise.all([
    measureAsyncDuration("world-profile-contract-resolution", async () =>
      resolveWorldContracts(factorySqlBaseUrl, name),
    ),
    measureAsyncDuration("world-profile-deployment-resolution", async () =>
      resolveWorldDeploymentFromFactory(factorySqlBaseUrl, chain, name),
    ),
  ]);

  return { contractsBySelector, deployment };
};

const resolveWorldAddressFromTorii = async (toriiBaseUrl: string): Promise<string | null> => {
  return measureAsyncDuration("world-profile-world-address-fetch", async () => {
    try {
      const sqlApi = new SqlApi(`${toriiBaseUrl}/sql`);
      const fetched = await sqlApi.fetchWorldAddress();
      return normalizeAddress(fetched);
    } catch {
      return null;
    }
  });
};

const resolveWorldConfigAddresses = async (
  toriiBaseUrl: string,
): Promise<{ entryTokenAddress?: string; feeTokenAddress?: string }> => {
  return measureAsyncDuration("world-profile-config-fetch", async () => {
    try {
      const configQuery = `SELECT "blitz_registration_config.entry_token_address" AS entry_token_address, "blitz_registration_config.fee_token" AS fee_token FROM "s1_eternum-WorldConfig" LIMIT 1;`;
      const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(configQuery)}`;
      const response = await fetch(url);
      if (!response.ok) {
        return {};
      }

      const [row] = (await response.json()) as Record<string, unknown>[];
      if (!row) {
        return {};
      }

      return {
        entryTokenAddress: normalizeAddress(row.entry_token_address) ?? undefined,
        feeTokenAddress: normalizeAddress(row.fee_token) ?? undefined,
      };
    } catch {
      return {};
    }
  });
};

const resolveS2GameRow = async (
  toriiBaseUrl: string,
  name: string,
): Promise<{ gameId: number; presetId: number } | null> => {
  return measureAsyncDuration("game-profile-registry-fetch", async () => fetchS2GameRow(toriiBaseUrl, name));
};

const resolveS2ChainConfig = async (
  toriiBaseUrl: string,
): Promise<{ entryTokenAddress?: string; feeTokenAddress?: string }> => {
  return measureAsyncDuration("game-profile-chain-config-fetch", async () => {
    try {
      // ChainConfig is a genuine chain-wide singleton — the one LIMIT 1 that stays correct.
      const query = `SELECT entry_token_address, fee_token FROM "${appchainModel("ChainConfig")}" LIMIT 1;`;
      const response = await fetch(`${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`);
      if (!response.ok) return {};
      const [row] = (await response.json()) as Record<string, unknown>[];
      if (!row) return {};
      return {
        entryTokenAddress: normalizeAddress(row.entry_token_address) ?? undefined,
        feeTokenAddress: normalizeAddress(row.fee_token) ?? undefined,
      };
    } catch {
      return {};
    }
  });
};

/**
 * Appchain: everything except the game row is a directory/build-time constant
 * — endpoints, world address and contract map come from the world entry. One
 * GameRegistry lookup resolves the game inside that world.
 */
const buildS2GameProfile = async (name: string, worldId?: string): Promise<GameProfile> => {
  // Routes carry only (chain, name); recover which world owns the game.
  const resolvedWorldId = worldId ?? (await resolveAppchainWorldIdForGame(name));
  const world = getWorldById(resolvedWorldId) ?? getDefaultWorld();

  const [game, chainConfig] = await Promise.all([
    resolveS2GameRow(world.toriiBaseUrl, name),
    resolveS2ChainConfig(world.toriiBaseUrl),
  ]);
  if (!game) {
    throw new Error(`Game "${name}" not found in the ${world.id} world's GameRegistry`);
  }

  const profile: GameProfile = {
    name,
    chain: world.chain,
    worldId: world.id,
    namespace: world.namespace,
    toriiBaseUrl: world.toriiBaseUrl,
    rpcUrl: normalizeRpcUrl(world.rpcUrl),
    worldAddress: world.worldAddress,
    contractsBySelector: world.contractsBySelector,
    entryTokenAddress: chainConfig.entryTokenAddress,
    feeTokenAddress: chainConfig.feeTokenAddress,
    gameId: game.gameId,
    presetId: game.presetId,
    fetchedAt: Date.now(),
  };
  saveWorldProfile(profile);
  return profile;
};

/**
 * Build a GameProfile. Appchain resolves against the persistent s2 world;
 * mainnet keeps the legacy factory/per-world-torii flow until its own migration.
 */
export const buildWorldProfile = async (chain: Chain, name: string, worldId?: string): Promise<WorldProfile> => {
  if (chain === "appchain") {
    return buildS2GameProfile(name, worldId);
  }
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  const isSharedTorii = false;
  const toriiBaseUrl = toriiBaseUrlFromName(name);

  // 1) Resolve selectors -> addresses and deployment metadata from the factory.
  const { contractsBySelector, deployment } = await resolveFactoryWorldData(factorySqlBaseUrl, chain, name);

  // 2) Resolve world address from the selected world's Torii.
  //    Both lookups below assume the torii serves a single world (they read
  //    WorldConfig unscoped), which is true per-game on mainnet but not on the
  //    appchain's shared indexer — there they would return an arbitrary
  //    world's data. The factory row is keyed by game name, so use it instead.
  const [{ entryTokenAddress, feeTokenAddress }, worldAddressFromTorii] = isSharedTorii
    ? [{ entryTokenAddress: undefined, feeTokenAddress: undefined }, null]
    : await Promise.all([resolveWorldConfigAddresses(toriiBaseUrl), resolveWorldAddressFromTorii(toriiBaseUrl)]);

  let worldAddress: string | null = worldAddressFromTorii;
  if (!worldAddress) {
    // Fallback: read from factory's wf-WorldDeployed table
    worldAddress = normalizeAddress(deployment?.worldAddress) ?? deployment?.worldAddress ?? null;
  }

  // As a last resort, default to 0x0 so configuration can still proceed with patched contracts
  if (!worldAddress) worldAddress = "0x0";

  const chainDefaultRpcUrl =
    chain === "mainnet" || chain === "sepolia" ? `${cartridgeApiBase}/x/starknet/${chain}` : env.VITE_PUBLIC_NODE_URL;
  const canUseEnvRpc = hasPublicNodeUrl && isRpcUrlCompatibleForChain(chain, env.VITE_PUBLIC_NODE_URL);
  const fallbackRpcUrl = canUseEnvRpc ? env.VITE_PUBLIC_NODE_URL : chainDefaultRpcUrl;
  const rpcUrl = normalizeRpcUrl(deployment?.rpcUrl ?? fallbackRpcUrl);

  const profile: WorldProfile = {
    name,
    chain,
    toriiBaseUrl,
    rpcUrl,
    worldAddress,
    contractsBySelector,
    entryTokenAddress,
    feeTokenAddress,
    fetchedAt: Date.now(),
  };

  // Persist immediately
  saveWorldProfile(profile);
  return profile;
};
