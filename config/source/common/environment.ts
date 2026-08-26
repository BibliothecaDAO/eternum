import { getGameManifest, getSeasonAddresses } from "@contracts";
import type { GameChain } from "@realms-world/chain";
import type { ConfigPatch } from "./merge-config";
import type { GameType } from "./types";

interface EnvironmentAddresses extends Record<string, string | undefined> {
  collectiblesClassHash?: string;
  lords?: string;
  mmrToken?: string;
  strk?: string;
  villagePass?: string;
}

export interface EnvironmentContext {
  chain: GameChain;
  addresses: EnvironmentAddresses;
  manifest: unknown;
  startMainAt: number;
  startSettlingAt: number;
  vrfProviderAddress: string;
}

export function resolveConfiguredAddress(address: string | undefined | null, name: string): string {
  if (!address) {
    throw new Error(`${name} address is not configured`);
  }
  return address;
}

export async function resolveEnvironmentContext(chain: GameChain, gameType: GameType): Promise<EnvironmentContext> {
  return {
    chain,
    addresses: ((await getSeasonAddresses(chain)) ?? {}) as unknown as EnvironmentAddresses,
    manifest: await getGameManifest(chain, gameType),
    startSettlingAt: Number(process.env.CONFIG_START_SETTLING_AT) || 0,
    startMainAt: Number(process.env.CONFIG_START_MAIN_AT) || 0,
    vrfProviderAddress: process.env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS || "0x0",
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
