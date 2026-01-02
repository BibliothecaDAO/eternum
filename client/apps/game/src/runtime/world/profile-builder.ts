import type { Chain } from "@contracts";
import { SqlApi } from "@bibliothecadao/torii";

import { getFactorySqlBaseUrl } from "./factory-endpoints";
import { resolveWorldContracts, resolveWorldDeploymentFromFactory } from "./factory-resolver";
import { isRpcUrlCompatibleForChain, normalizeRpcUrl } from "./normalize";
import { saveWorldProfile } from "./store";
import type { WorldProfile } from "./types";
import { env, hasPublicNodeUrl } from "../../../env";

const cartridgeApiBase = env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg";

export const toriiBaseUrlFromName = (name: string) => `${cartridgeApiBase}/x/${name}/torii`;

/**
 * Build a WorldProfile by querying the factory and the target world's Torii.
 */
export const buildWorldProfile = async (chain: Chain, name: string): Promise<WorldProfile> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  const toriiBaseUrl = toriiBaseUrlFromName(name);

  // 1) Resolve selectors -> addresses from the factory
  const contractsBySelector = await resolveWorldContracts(factorySqlBaseUrl, name);
  const deployment = await resolveWorldDeploymentFromFactory(factorySqlBaseUrl, name);

  // 2) Resolve world address from the selected world's Torii
  let worldAddress: string | null = null;
  const normalizeAddress = (addr: unknown): string | null => {
    if (addr == null) return null;
    if (typeof addr === "string") return addr;
    if (typeof addr === "bigint") return "0x" + addr.toString(16);
    return null;
  };
  try {
    const sqlApi = new SqlApi(`${toriiBaseUrl}/sql`);
    const fetched = await sqlApi.fetchWorldAddress();
    worldAddress = normalizeAddress(fetched);
  } catch {
    // ignore and try factory fallback
  }

  if (!worldAddress) {
    // Fallback: read from factory's wf-WorldDeployed table
    worldAddress = normalizeAddress(deployment?.worldAddress) ?? deployment?.worldAddress ?? null;
  }

  // As a last resort, default to 0x0 so configuration can still proceed with patched contracts
  if (!worldAddress) worldAddress = "0x0";

  const slotDefaultRpcUrl = `${cartridgeApiBase}/x/eternum-blitz-slot-3/katana`;
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
    fetchedAt: Date.now(),
  };

  // Persist immediately
  saveWorldProfile(profile);
  return profile;
};
