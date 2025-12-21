import type { Chain } from "@contracts";
import { SqlApi } from "@bibliothecadao/torii";
import type { WorldProfile } from "./types";
import { getFactorySqlBaseUrl } from "./factory-endpoints";
import { resolveWorldAddressFromFactory, resolveWorldContracts } from "./factory-resolver";
import { saveWorldProfile } from "./store";

export const toriiBaseUrlFromName = (name: string) => `https://api.cartridge.gg/x/${name}/torii`;

export const buildWorldProfile = async (chain: Chain, name: string): Promise<WorldProfile> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  const toriiBaseUrl = toriiBaseUrlFromName(name);

  const contractsBySelector = await resolveWorldContracts(factorySqlBaseUrl, name);

  let worldAddress: string | null = null;
  const normalizeAddress = (value: unknown): string | null => {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "bigint") return `0x${value.toString(16)}`;
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
    const fallback = await resolveWorldAddressFromFactory(factorySqlBaseUrl, name);
    worldAddress = normalizeAddress(fallback) ?? fallback;
  }

  if (!worldAddress) worldAddress = "0x0";

  const profile: WorldProfile = {
    name,
    chain,
    toriiBaseUrl,
    worldAddress,
    contractsBySelector,
    fetchedAt: Date.now(),
  };

  saveWorldProfile(profile);
  return profile;
};
