import { getGameManifest, getSeasonAddresses } from "@contracts";
import type { ConfigPatch } from "./merge-config";
import type { Chain } from "./types";
import { resolveConfiguredAddress } from "./address";

export { resolveConfiguredAddress };

interface EnvironmentAddresses extends Record<string, string | undefined> {
  collectiblesClassHash?: string;
  lords?: string;
  mmrToken?: string;
  strk?: string;
  villagePass?: string;
}

export interface EnvironmentContext {
  chain: Chain;
  addresses: EnvironmentAddresses;
  manifest: unknown;
  startMainAt: number;
  startSettlingAt: number;
  vrfProviderAddress: string;
}

export async function resolveEnvironmentContext(chain: Chain): Promise<EnvironmentContext> {
  const addresses = ((await getSeasonAddresses(chain)) ?? {}) as unknown as EnvironmentAddresses;

  return {
    chain,
    addresses,
    manifest: await getGameManifest(chain),
    startSettlingAt: Number(process.env.CONFIG_START_SETTLING_AT) || 0,
    startMainAt: Number(process.env.CONFIG_START_MAIN_AT) || 0,
    vrfProviderAddress: resolveConfiguredAddress(addresses.vrfProvider),
  };
}

export function buildEnvironmentContextConfig(context: EnvironmentContext): ConfigPatch {
  return {
    season: {
      startSettlingAt: context.startSettlingAt,
      startMainAt: context.startMainAt,
    },
    vrf: {
      vrfProviderAddress: context.vrfProviderAddress,
    },
    setup: {
      chain: context.chain,
      addresses: context.addresses as never,
      manifest: context.manifest as never,
    },
  };
}
