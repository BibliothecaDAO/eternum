import { RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import type { GameChain } from "@realms-world/chain";
import type { ConfigPatch } from "../common/merge-config";
import { type EnvironmentContext, resolveConfiguredAddress } from "../common/environment";
import { mergeConfigPatches } from "../common/merge-config";

const APPCHAIN_ETERNUM_CHAIN_CONFIG: ConfigPatch = {
  troop: {
    limit: {
      mercenariesTroopLowerBound: 100,
      mercenariesTroopUpperBound: 200,
    },
    stamina: {
      staminaTravelStaminaCost: 0,
      staminaExploreStaminaCost: 0,
      staminaBonusValue: 0,
    },
  },
  battle: {
    regularImmunityTicks: 0,
    villageImmunityTicks: 0,
    delaySeconds: 0,
  },
  speed: {
    donkey_for_resources: 0,
    donkey_for_troops: 0,
  },
  season: {
    startSettlingAfterSeconds: 59,
    startMainAfterSeconds: 60,
    durationSeconds: 60 * 60 * 24 * 30,
    pointRegistrationCloseAfterEndSeconds: 60 * 10,
  },
  dev: {
    mode: {
      on: true,
    },
  },
};

const APPCHAIN_ETERNUM_REALM_UPGRADE_CONFIG: ConfigPatch = {
  realmUpgradeCosts: {
    [RealmLevels.Settlement]: [],
    [RealmLevels.City]: [
      { resource: ResourcesIds.Labor, amount: 1 },
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ],
    [RealmLevels.Kingdom]: [
      { resource: ResourcesIds.Labor, amount: 2 },
      { resource: ResourcesIds.Wheat, amount: 2 },
      { resource: ResourcesIds.Fish, amount: 2 },
    ],
    [RealmLevels.Empire]: [
      { resource: ResourcesIds.Labor, amount: 3 },
      { resource: ResourcesIds.Wheat, amount: 3 },
      { resource: ResourcesIds.Fish, amount: 3 },
      { resource: ResourcesIds.Wood, amount: 3 },
    ],
  },
};

function resolveEternumContractAddressConfig(context: EnvironmentContext): ConfigPatch {
  return {
    village: {
      village_pass_nft_address: resolveConfiguredAddress(context.addresses.villagePass, "villagePass"),
    },
    faith: {
      reward_token: resolveConfiguredAddress(context.addresses.lords, "lords"),
    },
  };
}

export function resolveEternumChainConfig(chain: GameChain, context: EnvironmentContext): ConfigPatch {
  if (chain !== "appchain") {
    throw new Error(`Eternum is not configured for ${chain}`);
  }

  return mergeConfigPatches(
    APPCHAIN_ETERNUM_CHAIN_CONFIG,
    resolveEternumContractAddressConfig(context),
    APPCHAIN_ETERNUM_REALM_UPGRADE_CONFIG,
  );
}
