import { SqlApi } from "@bibliothecadao/torii";
import type { Chain } from "@contracts";
import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";

import { env, hasPublicNodeUrl } from "../../../env";
import { getFactorySqlBaseUrl } from "./factory-endpoints";
import { resolveWorldContracts, resolveWorldDeploymentFromFactory } from "./factory-resolver";
import { isRpcUrlCompatibleForChain, normalizeRpcUrl } from "./normalize";
import { saveWorldProfile } from "./store";
import type { WorldProfile } from "./types";

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
  if (typeof addr === "string") return addr;
  if (typeof addr === "bigint") return "0x" + addr.toString(16);
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

/**
 * Build a WorldProfile by querying the factory and the target world's Torii.
 */
export const buildWorldProfile = async (chain: Chain, name: string): Promise<WorldProfile> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  const toriiBaseUrl = toriiBaseUrlFromName(name);

  // 1) Resolve selectors -> addresses and deployment metadata from the factory.
  const { contractsBySelector, deployment } = await resolveFactoryWorldData(factorySqlBaseUrl, chain, name);

  // 2) Resolve world address from the selected world's Torii
  const [{ entryTokenAddress, feeTokenAddress }, worldAddressFromTorii] = await Promise.all([
    resolveWorldConfigAddresses(toriiBaseUrl),
    resolveWorldAddressFromTorii(toriiBaseUrl),
  ]);

  let worldAddress: string | null = worldAddressFromTorii;
  if (!worldAddress) {
    // Fallback: read from factory's wf-WorldDeployed table
    worldAddress = normalizeAddress(deployment?.worldAddress) ?? deployment?.worldAddress ?? null;
  }

  // As a last resort, default to 0x0 so configuration can still proceed with patched contracts
  if (!worldAddress) worldAddress = "0x0";

  const slotDefaultRpcUrl = `${cartridgeApiBase}/x/eternum-blitz-slot-4/katana`;
  const chainDefaultRpcUrl =
    chain === "slot" || chain === "slottest"
      ? slotDefaultRpcUrl
      : chain === "mainnet" || chain === "sepolia"
        ? `${cartridgeApiBase}/x/starknet/${chain}`
        : env.VITE_PUBLIC_NODE_URL;
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
