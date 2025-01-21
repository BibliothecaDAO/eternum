import type { SeasonAddresses } from "@bibliothecadao/eternum";
import manifestMainnet from "../../../../../contracts/game/manifest_mainnet.json";
import manifestSepolia from "../../../../../contracts/game/manifest_sepolia.json";
import manifestLocal from "../../../../../contracts/game/manifest_slot.json";

import seasonAddressesMainnet from "../../../../../contracts/common/addresses/mainnet.json";
import seasonAddressesSepolia from "../../../../../contracts/common/addresses/sepolia.json";
import seasonAddressesLocal from "../../../../../contracts/common/addresses/slot.json";

/** Valid chain identifiers */
export type Chain = "local" | "sepolia" | "mainnet" | "slot";

/**
 * Retrieves the season addresses for a specific chain
 * @param chain - The chain identifier
 * @returns The contract addresses for the specified chain
 * @throws Error if addresses cannot be loaded
 */
export function getSeasonAddresses(chain: Chain): SeasonAddresses {
  const addressesMap = {
    local: seasonAddressesLocal,
    sepolia: seasonAddressesSepolia,
    mainnet: seasonAddressesMainnet,
    slot: seasonAddressesLocal,
  };

  const addresses = addressesMap[chain] as {
    seasonPass?: string;
    realms?: string;
    lords?: string;
    resources?: Record<string, string | number[]>;
  };

  if (!addresses?.resources) {
    throw new Error(`Invalid addresses for chain: ${chain}`);
  }

  return {
    seasonPass: addresses.seasonPass ?? "",
    realms: addresses.realms ?? "",
    lords: addresses.lords ?? "",
    resources: Object.fromEntries(
      Object.entries(addresses.resources).map(([key, value]) => [
        key,
        Array.isArray(value) ? (value as [number, string]) : [0, value as string],
      ]),
    ),
  } as SeasonAddresses;
}

/**
 * Interface representing the game manifest configuration
 * @interface GameManifest
 */
interface GameManifest {
  [key: string]: unknown;
}

/**
 * Retrieves the game manifest for a specific chain
 * @param chain - The chain identifier
 * @returns The game manifest configuration
 * @throws Error if manifest cannot be loaded
 */
// export async function getGameManifest(chain: Chain): Promise<GameManifest> {
export function getGameManifest(chain: Chain): GameManifest {
  // const MANIFEST_FILE = `../../contracts/game/manifest_${chain}.json`;
  try {
    // const manifest = (await import(MANIFEST_FILE)).default;

    switch (chain) {
      case "local":
        return manifestLocal;
      case "sepolia":
        return manifestSepolia;
      case "mainnet":
        return manifestMainnet;
      default:
        throw new Error(`Invalid chain: ${chain}`);
    }
  } catch (error) {
    throw new Error(`Failed to load game manifest for chain ${chain}: ${error}`);
  }
}
