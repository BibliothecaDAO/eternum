import type { Chain } from "@contracts";
import { SqlApi } from "@bibliothecadao/torii";

import { getFactorySqlBaseUrl } from "./factory-endpoints";
import { resolveWorldContracts, resolveWorldAddressFromFactory } from "./factory-resolver";
import { saveWorldProfile } from "./store";
import type { WorldProfile } from "./types";

export const toriiBaseUrlFromName = (name: string) => `https://api.cartridge.gg/x/${name}/torii`;

/**
 * Build a WorldProfile by querying the factory and the target world's Torii.
 */
export const buildWorldProfile = async (chain: Chain, name: string): Promise<WorldProfile> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  const toriiBaseUrl = toriiBaseUrlFromName(name);

  // 1) Resolve selectors -> addresses from the factory
  const contractsBySelector = await resolveWorldContracts(factorySqlBaseUrl, name);

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
    const fallback = await resolveWorldAddressFromFactory(factorySqlBaseUrl, name);
    worldAddress = normalizeAddress(fallback) ?? fallback;
  }

  // As a last resort, default to 0x0 so configuration can still proceed with patched contracts
  if (!worldAddress) worldAddress = "0x0";

  const profile: WorldProfile = {
    name,
    chain,
    toriiBaseUrl,
    worldAddress,
    contractsBySelector,
    fetchedAt: Date.now(),
  };

  // Persist immediately
  saveWorldProfile(profile);
  return profile;
};
