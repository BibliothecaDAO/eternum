import { getSeasonAddresses } from "../../../contracts/utils/utils";
import type { ConfigurationNetwork } from "../../shared/game-environments";
import type { ConfigPatch } from "./merge-config";

interface EnvironmentAddresses extends Record<string, string | undefined> {
  collectiblesClassHash?: string;
  lords?: string;
  mmrToken?: string;
  strk?: string;
  villagePass?: string;
}

export interface EnvironmentContext {
  chain: ConfigurationNetwork;
  addresses: EnvironmentAddresses;
  startMainAt: number;
  startSettlingAt: number;
}

export function resolveConfiguredAddress(address: string | undefined | null, name: string): string {
  if (!address) {
    throw new Error(`${name} address is not configured`);
  }
  return address;
}

export function resolveEnvironmentContext(chain: ConfigurationNetwork): EnvironmentContext {
  return {
    chain,
    addresses: getSeasonAddresses(chain) as unknown as EnvironmentAddresses,
    startSettlingAt: Number(process.env.CONFIG_START_SETTLING_AT) || 0,
    startMainAt: Number(process.env.CONFIG_START_MAIN_AT) || 0,
  };
}

export function buildEnvironmentContextConfig(context: EnvironmentContext): ConfigPatch {
  return {
    season: {
      startSettlingAt: context.startSettlingAt,
      startMainAt: context.startMainAt,
    },
    setup: {
      chain: context.chain,
      addresses: context.addresses as never,
    },
  };
}
