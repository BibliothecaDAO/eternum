import { RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import type { ConfigPatch } from "../common/merge-config";
import { type EnvironmentContext, resolveConfiguredAddress } from "../common/environment";
import { mergeConfigPatches } from "../common/merge-config";
import type { Chain } from "../common/types";

const LOCAL_ETERNUM_CHAIN_CONFIG: ConfigPatch = {
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
    donkey: 0,
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

const MAINNET_ETERNUM_CHAIN_CONFIG: ConfigPatch = {
  season: {
    startSettlingAfterSeconds: 59,
    startMainAfterSeconds: 60,
    durationSeconds: 60 * 60 * 2,
    pointRegistrationCloseAfterEndSeconds: 60 * 10,
  },
  battle: {
    regularImmunityTicks: 0,
    villageImmunityTicks: 0,
    delaySeconds: 0,
  },
};

const SEPOLIA_ETERNUM_CHAIN_CONFIG: ConfigPatch = {
  agent: {
    controller_address: "0x01BFC84464f990C09Cc0e5D64D18F54c3469fD5c467398BF31293051bAde1C39",
  },
  village: {
    village_mint_initial_recipient: "0x054f2b25070d70d49f1c1f7c10Ef2639889fDAc15894D3FBa1a03caF5603eCA3",
  },
  troop: {
    limit: {
      mercenariesTroopLowerBound: 100,
      mercenariesTroopUpperBound: 1500,
    },
  },
  exploration: {
    questFindProbability: 1,
    questFindFailProbability: 10,
  },
  season: {
    pointRegistrationCloseAfterEndSeconds: 60 * 60,
    bridgeCloseAfterEndSeconds: 60 * 60,
    startSettlingAfterSeconds: 60 * 30,
    startMainAfterSeconds: 60 * 60,
  },
  battle: {
    regularImmunityTicks: 40,
  },
  questGames: [
    {
      address: "0x2418e02ae43901d8aa8ab5c4b676740dccdcf1c94f13344a978ebe6077b109",
      levels: [
        { target_score: 26, settings_id: 1, time_limit: 86400 },
        { target_score: 26, settings_id: 2, time_limit: 86400 },
        { target_score: 26, settings_id: 3, time_limit: 86400 },
        { target_score: 51, settings_id: 4, time_limit: 86400 },
        { target_score: 101, settings_id: 5, time_limit: 86400 },
      ],
      overwrite: true,
    },
  ],
};

const SLOT_ETERNUM_CHAIN_CONFIG: ConfigPatch = {
  exploration: {
    bitcoinMineWinProbability: 30,
    bitcoinMineFailProbability: 70,
    shardsMinesWinProbability: 40,
    shardsMinesFailProbability: 60,
    campFindProbability: 50,
    campFindFailProbability: 50,
    holysiteFindProbability: 60,
    holysiteFindFailProbability: 40,
  },
  season: {
    startSettlingAfterSeconds: 59,
    startMainAfterSeconds: 60,
    durationSeconds: 0,
    pointRegistrationCloseAfterEndSeconds: 60 * 60 * 24,
  },
  battle: {
    regularImmunityTicks: 1,
    villageImmunityTicks: 3,
    villageRaidImmunityTicks: 1,
  },
};

const SLOTTEST_ETERNUM_CHAIN_CONFIG: ConfigPatch = {
  season: {
    startSettlingAfterSeconds: 59,
    startMainAfterSeconds: 60,
    durationSeconds: 60 * 60 * 24 * 90,
    pointRegistrationCloseAfterEndSeconds: 60 * 10,
  },
  battle: {
    regularImmunityTicks: 0,
    villageImmunityTicks: 0,
    delaySeconds: 0,
  },
  dev: {
    mode: {
      on: true,
    },
  },
};

const LOCAL_ETERNUM_REALM_UPGRADE_CONFIG: ConfigPatch = {
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
      village_pass_nft_address: resolveConfiguredAddress(context.addresses.villagePass),
    },
    faith: {
      reward_token: resolveConfiguredAddress(context.addresses.lords),
    },
  };
}

export function resolveEternumChainConfig(chain: Chain, context: EnvironmentContext): ConfigPatch {
  switch (chain) {
    case "local":
      return mergeConfigPatches(
        LOCAL_ETERNUM_CHAIN_CONFIG,
        resolveEternumContractAddressConfig(context),
        LOCAL_ETERNUM_REALM_UPGRADE_CONFIG,
      );
    case "mainnet":
      return mergeConfigPatches(MAINNET_ETERNUM_CHAIN_CONFIG, resolveEternumContractAddressConfig(context));
    case "sepolia":
      return mergeConfigPatches(SEPOLIA_ETERNUM_CHAIN_CONFIG, resolveEternumContractAddressConfig(context));
    case "slot":
      return mergeConfigPatches(SLOT_ETERNUM_CHAIN_CONFIG, resolveEternumContractAddressConfig(context));
    case "slottest":
      return mergeConfigPatches(SLOTTEST_ETERNUM_CHAIN_CONFIG, resolveEternumContractAddressConfig(context));
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}
