import { getSeasonAddresses, type Chain } from "@contracts";
import { resolvePrizeDistributionSystemsAddress, isZeroAddress } from "../factory/discovery";
import type { GameManifestLike } from "../shared/manifest-types";
import { MINTER_ROLE } from "../eternum/roles";
import { buildGrantRoleCall, type GrantRoleCall } from "./grant-role";

export interface LootChestMinterRoleGrantTarget {
  lootChestAddress: string;
  prizeDistributionSystemsAddress: string;
}

function resolveConfiguredLootChestAddress(config: unknown): string | undefined {
  const configuredAddress = (config as Record<string, any>)?.blitz?.registration?.collectibles_lootchest_address;

  if (typeof configuredAddress === "string" && !isZeroAddress(configuredAddress)) {
    return configuredAddress;
  }

  return undefined;
}

export function resolveLootChestAddress(chain: Chain, config: unknown): string | undefined {
  const configuredAddress = resolveConfiguredLootChestAddress(config);
  if (configuredAddress) {
    return configuredAddress;
  }

  const addresses = getSeasonAddresses(chain);
  return addresses["Collectibles: Realms: Loot Chest"] || addresses.lootChests;
}

export function resolveLootChestMinterRoleGrantTarget(params: {
  chain: Chain;
  config: unknown;
  patchedManifest: GameManifestLike;
}): LootChestMinterRoleGrantTarget | null {
  const lootChestAddress = resolveLootChestAddress(params.chain, params.config);
  if (!lootChestAddress || isZeroAddress(lootChestAddress)) {
    return null;
  }

  return {
    lootChestAddress,
    prizeDistributionSystemsAddress: resolvePrizeDistributionSystemsAddress(params.patchedManifest),
  };
}

export function buildLootChestMinterRoleGrantCall(target: LootChestMinterRoleGrantTarget): GrantRoleCall {
  return buildGrantRoleCall(target.lootChestAddress, MINTER_ROLE, target.prizeDistributionSystemsAddress);
}
