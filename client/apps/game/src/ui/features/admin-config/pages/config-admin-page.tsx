import Button from "@/ui/design-system/atoms/button";
import { Controller } from "@/ui/modules/controller/controller";
import { ETERNUM_CONFIG } from "@/utils/config";
import { useDojo } from "@bibliothecadao/react";
import type { Config } from "@bibliothecadao/types";
import {
  SetResourceFactoryConfig,
  setAgentConfig,
  setBattleConfig,
  setBlitzPreviousGame,
  setBlitzRegistrationConfig,
  setBuildingConfig,
  setCapacityConfig,
  setDiscoverableVillageSpawnResourcesConfig,
  setGameModeConfig,
  setHyperstructureConfig,
  setRealmUpgradeConfig,
  setResourceBridgeFeesConfig,
  setResourceBridgeWtlConfig,
  setSeasonConfig,
  setSettlementConfig,
  setSpeedConfig,
  setStartingResourcesConfig,
  setStructureMaxLevelConfig,
  setTradeConfig,
  setTroopConfig,
  setVRFConfig,
  setVictoryPointsConfig,
  setVillageControllersConfig,
  setWeightConfig,
  setWonderBonusConfig,
  setWorldConfig,
  setupGlobals
} from "@config-deployer/config";
import {
  Activity,
  CheckCircle2,
  Clock,
  Cog,
  Coins,
  Database,
  DollarSign,
  Factory,
  HelpCircle,
  Map,
  Server,
  Settings,
  Shield,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Users,
  XCircle,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type TxState = { status: "idle" | "running" | "success" | "error"; hash?: string; error?: string };

// Helper to convert bigint/string to number safely
const toNumber = (value: bigint | number | string | undefined, fallback: number = 0): number => {
  if (value === undefined) return fallback;
  return typeof value === 'bigint' ? Number(value) : typeof value === 'string' ? Number(value) : value;
};

// Helper to convert hex felt to ASCII string
const hexToAscii = (hex: string): string => {
  try {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    // Convert hex to ASCII
    let str = "";
    for (let i = 0; i < cleanHex.length; i += 2) {
      const charCode = parseInt(cleanHex.substr(i, 2), 16);
      if (charCode > 0) {
        str += String.fromCharCode(charCode);
      }
    }
    return str;
  } catch {
    return "";
  }
};

// Resource ID to Name mapping
const RESOURCE_NAMES: Record<number, string> = {
  1: "Stone",
  2: "Coal",
  3: "Wood",
  4: "Copper",
  5: "Ironwood",
  6: "Obsidian",
  7: "Gold",
  8: "Silver",
  9: "Mithral",
  10: "Alchemical Silver",
  11: "Cold Iron",
  12: "Deep Crystal",
  13: "Ruby",
  14: "Diamonds",
  15: "Hartwood",
  16: "Ignium",
  17: "Twilight Quartz",
  18: "True Ice",
  19: "Adamantine",
  20: "Sapphire",
  21: "Ethereal Silica",
  22: "Dragonhide",
  23: "Labor",
  24: "Ancient Fragment",
  25: "Donkey",
  26: "Knight",
  27: "Knight T2",
  28: "Knight T3",
  29: "Crossbowman",
  30: "Crossbowman T2",
  31: "Crossbowman T3",
  32: "Paladin",
  33: "Paladin T2",
  34: "Paladin T3",
  35: "Wheat",
  36: "Fish",
  37: "Lords",
  38: "Essence",
};

const getResourceName = (id: number): string => {
  return RESOURCE_NAMES[id] || `Unknown (${id})`;
};

// Get sorted list of all resources for dropdown
const getAllResources = (): Array<{ id: number; name: string }> => {
  return Object.entries(RESOURCE_NAMES)
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((a, b) => a.id - b.id);
};

// Centralized config state interface
interface AdminConfigState {
  // World
  worldAdminAddress: string;
  mercenariesNameHex: string;

  // Season
  seasonDevMode: boolean;
  seasonPassAddress: string;
  realmsAddress: string;
  lordsAddress: string;
  seasonStartSettlingAt: number;
  seasonStartMainAt: number;
  seasonEndAt: number;
  seasonBridgeCloseAfterEnd: number;
  seasonPointRegistrationGrace: number;

  // VRF
  vrfProviderAddress: string;

  // Bridge Fees
  rbVelordsFeeDpt: number;
  rbVelordsFeeWtdr: number;
  rbSeasonPoolFeeDpt: number;
  rbSeasonPoolFeeWtdr: number;
  rbClientFeeDpt: number;
  rbClientFeeWtdr: number;
  rbRealmFeeDpt: number;
  rbRealmFeeWtdr: number;
  rbVelordsRecipient: string;
  rbSeasonPoolRecipient: string;

  // Agent
  agentControllerAddress: string;
  agentMaxLifetime: number;
  agentMaxCurrent: number;
  agentMinSpawn: number;
  agentMaxSpawn: number;

  // Village Token
  villagePassNftAddress: string;
  villageMintInitialRecipient: string;

  // Wonder Bonus
  wonderTileDistance: number;
  wonderBonusPercentNum: number;

  // Capacity
  realmCapacity: number;
  villageCapacity: number;
  hyperstructureCapacity: number;
  fragmentMineCapacity: number;
  bankStructureCapacity: number;
  troopCapacity: number;
  donkeyCapacity: number;
  storehouseBoostCapacity: number;

  // Speed
  donkeySecPerKm: number;

  // Trade
  tradeMaxCount: number;

  // Exploration / Map
  mapRewardAmount: number;
  shardsMinesWinProb: number;
  shardsMinesFailProb: number;
  agentFindProb: number;
  agentFindFailProb: number;
  villageFindProb: number;
  villageFindFailProb: number;
  hypsWinProb: number;
  hypsFailProb: number;
  hypsFailProbIncreaseHex: number;
  hypsFailProbIncreaseFound: number;
  relicDiscoveryInterval: number;
  relicHexDist: number;
  relicChestRelicsPerChest: number;

  // Victory Points
  pointsForWin: number;
  hypsPointsPerSecond: number;
  hypsClaimVsBanditsPoints: number;
  nonHypsClaimVsBanditsPoints: number;
  tileExplorationPoints: number;

  // Battle
  battleGraceTicks: number;
  battleGraceTicksHyp: number;

  // Tick
  tickIntervalSeconds: number;
  deliveryTickIntervalSeconds: number;

  // Blitz
  blitzModeOn: boolean;
  blitzPrevGameAddress: string;

  // Blitz Registration
  blitzRegFeeToken: string;
  blitzRegFeeRecipient: string;
  blitzRegFeeAmount: number;
  blitzRegCountMax: number;
  blitzRegDelaySeconds: number;
  blitzRegPeriodSeconds: number;
  blitzRegEntryTokenClassHash: string;
  blitzRegEntryTokenIpfsCid: string;
  blitzRegCollectibleCosmeticsMax: number;
  blitzRegCollectibleCosmeticsAddress: string;
  blitzRegCollectibleTimelockAddress: string;
  blitzRegCollectiblesLootchestAddress: string;

  // Hyperstructure
  hypInitializeShardsAmount: number;
  hypConstructionResourcesJson: string;

  // Settlement
  settlementCenterX: number;
  settlementCenterY: number;
  settlementBaseDistance: number;
  settlementSubsequentDistance: number;

  // Bank
  bankLpFeeNum: number;
  bankLpFeeDenom: number;
  bankOwnerFeeNum: number;
  bankOwnerFeeDenom: number;

  // Troop Damage
  troopT1Damage: number;
  troopT2DamageMultiplier: number;
  troopT3DamageMultiplier: number;
  troopDamageRaidPercent: number;
  troopDamageBiomeBonus: number;
  troopDamageScalingFactor: number;
  troopDamageBetaSmall: number;
  troopDamageBetaLarge: number;
  troopDamageC0: number;
  troopDamageDelta: number;

  // Troop Stamina
  staminaGainPerTick: number;
  staminaInitial: number;
  staminaBonusValue: number;
  staminaKnightMax: number;
  staminaPaladinMax: number;
  staminaCrossbowmanMax: number;
  staminaAttackReq: number;
  staminaDefenseReq: number;
  staminaExploreWheatCost: number;
  staminaExploreFishCost: number;
  staminaExploreStaminaCost: number;
  staminaTravelWheatCost: number;
  staminaTravelFishCost: number;
  staminaTravelStaminaCost: number;

  // Troop Limits
  explorerMaxPartyCount: number;
  explorerGuardMaxTroopCount: number;
  guardResurrectionDelay: number;
  mercenariesTroopLowerBound: number;
  mercenariesTroopUpperBound: number;
  agentTroopLowerBound: number;
  agentTroopUpperBound: number;

  // Structure Levels
  realmMaxLevel: number;
  villageMaxLevel: number;

  // Complex JSON configs (as strings)
  weightJson: string;
  resourceFactoryJson: string;
  whitelistJson: string;
  structureLevelJson: string;
  buildingCategoryJson: string;
  startingResourcesJson: string;
  villageStartingResourcesJson: string;
  discoverableVillageJson: string;
}

// Initialize config state from ETERNUM_CONFIG
const initializeConfigState = (config: Config, masterAddress: string): AdminConfigState => {
  return {
    // World
    worldAdminAddress: masterAddress,
    mercenariesNameHex: "0x5468652056616e6775617264",

    // Season
    seasonDevMode: false,
    seasonPassAddress: config.setup?.addresses?.seasonPass ?? "",
    realmsAddress: config.setup?.addresses?.realms ?? "",
    lordsAddress: config.setup?.addresses?.lords ?? "",
    seasonStartSettlingAt: config.season?.startSettlingAt ?? 0,
    seasonStartMainAt: config.season?.startMainAt ?? 0,
    seasonEndAt: (config.season?.startMainAt ?? 0) + (config.season?.durationSeconds ?? 0),
    seasonBridgeCloseAfterEnd: config.season?.bridgeCloseAfterEndSeconds ?? 0,
    seasonPointRegistrationGrace: config.season?.pointRegistrationCloseAfterEndSeconds ?? 0,

    // VRF
    vrfProviderAddress: config.vrf?.vrfProviderAddress ?? "",

    // Bridge Fees
    rbVelordsFeeDpt: config.bridge?.velords_fee_on_dpt_percent ?? 0,
    rbVelordsFeeWtdr: config.bridge?.velords_fee_on_wtdr_percent ?? 0,
    rbSeasonPoolFeeDpt: config.bridge?.season_pool_fee_on_dpt_percent ?? 0,
    rbSeasonPoolFeeWtdr: config.bridge?.season_pool_fee_on_wtdr_percent ?? 0,
    rbClientFeeDpt: config.bridge?.client_fee_on_dpt_percent ?? 0,
    rbClientFeeWtdr: config.bridge?.client_fee_on_wtdr_percent ?? 0,
    rbRealmFeeDpt: config.bridge?.realm_fee_dpt_percent ?? 0,
    rbRealmFeeWtdr: config.bridge?.realm_fee_wtdr_percent ?? 0,
    rbVelordsRecipient: config.bridge?.velords_fee_recipient ?? "",
    rbSeasonPoolRecipient: config.bridge?.season_pool_fee_recipient ?? "",

    // Agent
    agentControllerAddress: config.agent?.controller_address ?? "",
    agentMaxLifetime: config.agent?.max_lifetime_count ?? 0,
    agentMaxCurrent: config.agent?.max_current_count ?? 0,
    agentMinSpawn: config.agent?.min_spawn_lords_amount ?? 0,
    agentMaxSpawn: config.agent?.max_spawn_lords_amount ?? 0,

    // Village Token
    villagePassNftAddress: config.village?.village_pass_nft_address ?? "",
    villageMintInitialRecipient: config.village?.village_mint_initial_recipient ?? "",

    // Wonder Bonus
    wonderTileDistance: config.wonderProductionBonus?.within_tile_distance ?? 0,
    wonderBonusPercentNum: config.wonderProductionBonus?.bonus_percent_num ?? 0,

    // Capacity
    realmCapacity: toNumber(config.carryCapacityGram?.[1], 1_000_000),
    villageCapacity: toNumber(config.carryCapacityGram?.[2], 250_000),
    hyperstructureCapacity: toNumber(config.carryCapacityGram?.[3], 0),
    fragmentMineCapacity: toNumber(config.carryCapacityGram?.[5], 0),
    bankStructureCapacity: toNumber(config.carryCapacityGram?.[4], 0),
    troopCapacity: toNumber(config.carryCapacityGram?.[7], 0),
    donkeyCapacity: toNumber(config.carryCapacityGram?.[6], 0),
    storehouseBoostCapacity: toNumber(config.carryCapacityGram?.[8], 0),

    // Speed
    donkeySecPerKm: config.speed?.donkey ?? 0,

    // Trade
    tradeMaxCount: config.trade?.maxCount ?? 100,

    // Exploration / Map
    mapRewardAmount: config.exploration?.reward ?? 1,
    shardsMinesWinProb: config.exploration?.shardsMinesWinProbability ?? 0,
    shardsMinesFailProb: config.exploration?.shardsMinesFailProbability ?? 0,
    agentFindProb: config.exploration?.agentFindProbability ?? 0,
    agentFindFailProb: config.exploration?.agentFindFailProbability ?? 0,
    villageFindProb: config.exploration?.villageFindProbability ?? 0,
    villageFindFailProb: config.exploration?.villageFindFailProbability ?? 0,
    hypsWinProb: config.exploration?.hyperstructureWinProbAtCenter ?? 0,
    hypsFailProb: config.exploration?.hyperstructureFailProbAtCenter ?? 0,
    hypsFailProbIncreaseHex: config.exploration?.hyperstructureFailProbIncreasePerHexDistance ?? 0,
    hypsFailProbIncreaseFound: config.exploration?.hyperstructureFailProbIncreasePerHyperstructureFound ?? 0,
    relicDiscoveryInterval: config.exploration?.relicDiscoveryIntervalSeconds ?? 0,
    relicHexDist: config.exploration?.relicHexDistanceFromCenter ?? 0,
    relicChestRelicsPerChest: config.exploration?.relicChestRelicsPerChest ?? 0,

    // Victory Points
    pointsForWin: toNumber(config.victoryPoints?.pointsForWin, 1000),
    hypsPointsPerSecond: toNumber(config.victoryPoints?.hyperstructurePointsPerCycle, 0),
    hypsClaimVsBanditsPoints: toNumber(config.victoryPoints?.pointsForHyperstructureClaimAgainstBandits, 0),
    nonHypsClaimVsBanditsPoints: toNumber(config.victoryPoints?.pointsForNonHyperstructureClaimAgainstBandits, 0),
    tileExplorationPoints: toNumber(config.victoryPoints?.pointsForTileExploration, 0),

    // Battle
    battleGraceTicks: config.battle?.graceTickCount ?? 0,
    battleGraceTicksHyp: config.battle?.graceTickCountHyp ?? 0,

    // Tick
    tickIntervalSeconds: config.tick?.defaultTickIntervalInSeconds ?? 0,
    deliveryTickIntervalSeconds: config.tick?.deliveryTickIntervalInSeconds ?? 0,

    // Blitz
    blitzModeOn: config.blitz?.mode?.on ?? false,
    blitzPrevGameAddress: "",

    // Blitz Registration
    blitzRegFeeToken: config.blitz?.registration?.fee_token ?? "",
    blitzRegFeeRecipient: config.blitz?.registration?.fee_recipient ?? "",
    blitzRegFeeAmount: Number(config.blitz?.registration?.fee_amount ?? 0),
    blitzRegCountMax: config.blitz?.registration?.registration_count_max ?? 0,
    blitzRegDelaySeconds: config.blitz?.registration?.registration_delay_seconds ?? 0,
    blitzRegPeriodSeconds: config.blitz?.registration?.registration_period_seconds ?? 0,
    blitzRegEntryTokenClassHash: config.blitz?.registration?.entry_token_class_hash ?? "",
    blitzRegEntryTokenIpfsCid: config.blitz?.registration?.entry_token_ipfs_cid ?? "",
    blitzRegCollectibleCosmeticsMax: config.blitz?.registration?.collectible_cosmetics_max_items ?? 0,
    blitzRegCollectibleCosmeticsAddress: config.blitz?.registration?.collectible_cosmetics_address ?? "",
    blitzRegCollectibleTimelockAddress: config.blitz?.registration?.collectible_timelock_address ?? "",
    blitzRegCollectiblesLootchestAddress: config.blitz?.registration?.collectibles_lootchest_address ?? "",

    // Hyperstructure
    hypInitializeShardsAmount: (config.hyperstructures?.hyperstructureInitializationShardsCost as any)?.amount ?? 0,
    hypConstructionResourcesJson: JSON.stringify(config.hyperstructures?.hyperstructureConstructionCost ?? [], null, 2),

    // Settlement
    settlementCenterX: typeof config.settlement?.center === 'object' && config.settlement.center !== null && 'x' in config.settlement.center ? (config.settlement.center as any).x : 0,
    settlementCenterY: typeof config.settlement?.center === 'object' && config.settlement.center !== null && 'y' in config.settlement.center ? (config.settlement.center as any).y : 0,
    settlementBaseDistance: config.settlement?.base_distance ?? 0,
    settlementSubsequentDistance: config.settlement?.subsequent_distance ?? 0,

    // Bank
    bankLpFeeNum: config.banks?.lpFeesNumerator ?? 0,
    bankLpFeeDenom: config.banks?.lpFeesDenominator ?? 0,
    bankOwnerFeeNum: config.banks?.ownerFeesNumerator ?? 0,
    bankOwnerFeeDenom: config.banks?.ownerFeesDenominator ?? 0,

    // Troop Damage
    troopT1Damage: toNumber(config.troop?.damage?.t1DamageValue, 0),
    troopT2DamageMultiplier: toNumber(config.troop?.damage?.t2DamageMultiplier, 0),
    troopT3DamageMultiplier: toNumber(config.troop?.damage?.t3DamageMultiplier, 0),
    troopDamageRaidPercent: config.troop?.damage?.damageRaidPercentNum ?? 0,
    troopDamageBiomeBonus: config.troop?.damage?.damageBiomeBonusNum ?? 0,
    troopDamageScalingFactor: toNumber(config.troop?.damage?.damageScalingFactor, 0),
    troopDamageBetaSmall: toNumber(config.troop?.damage?.damageBetaSmall, 0),
    troopDamageBetaLarge: toNumber(config.troop?.damage?.damageBetaLarge, 0),
    troopDamageC0: toNumber(config.troop?.damage?.damageC0, 0),
    troopDamageDelta: toNumber(config.troop?.damage?.damageDelta, 0),

    // Troop Stamina
    staminaGainPerTick: config.troop?.stamina?.staminaGainPerTick ?? 0,
    staminaInitial: config.troop?.stamina?.staminaInitial ?? 0,
    staminaBonusValue: config.troop?.stamina?.staminaBonusValue ?? 0,
    staminaKnightMax: config.troop?.stamina?.staminaKnightMax ?? 0,
    staminaPaladinMax: config.troop?.stamina?.staminaPaladinMax ?? 0,
    staminaCrossbowmanMax: config.troop?.stamina?.staminaCrossbowmanMax ?? 0,
    staminaAttackReq: config.troop?.stamina?.staminaAttackReq ?? 0,
    staminaDefenseReq: config.troop?.stamina?.staminaDefenseReq ?? 0,
    staminaExploreWheatCost: config.troop?.stamina?.staminaExploreWheatCost ?? 0,
    staminaExploreFishCost: config.troop?.stamina?.staminaExploreFishCost ?? 0,
    staminaExploreStaminaCost: config.troop?.stamina?.staminaExploreStaminaCost ?? 0,
    staminaTravelWheatCost: config.troop?.stamina?.staminaTravelWheatCost ?? 0,
    staminaTravelFishCost: config.troop?.stamina?.staminaTravelFishCost ?? 0,
    staminaTravelStaminaCost: config.troop?.stamina?.staminaTravelStaminaCost ?? 0,

    // Troop Limits
    explorerMaxPartyCount: config.troop?.limit?.explorerMaxPartyCount ?? 0,
    explorerGuardMaxTroopCount: config.troop?.limit?.explorerAndGuardMaxTroopCount ?? 0,
    guardResurrectionDelay: config.troop?.limit?.guardResurrectionDelay ?? 0,
    mercenariesTroopLowerBound: config.troop?.limit?.mercenariesTroopLowerBound ?? 0,
    mercenariesTroopUpperBound: config.troop?.limit?.mercenariesTroopUpperBound ?? 0,
    agentTroopLowerBound: config.troop?.limit?.agentTroopLowerBound ?? 0,
    agentTroopUpperBound: config.troop?.limit?.agentTroopUpperBound ?? 0,

    // Structure Levels
    realmMaxLevel: config.realmMaxLevel ?? 0,
    villageMaxLevel: config.villageMaxLevel ?? 0,

    // Complex JSON configs
    weightJson: JSON.stringify(
      Object.entries(config.resources?.resourceWeightsGrams ?? {}).map(([entity_type, weight_nanogram]) => ({
        entity_type: Number(entity_type),
        weight_nanogram,
      })),
      null,
      2
    ),
    resourceFactoryJson: "[]",
    whitelistJson: "[]",
    structureLevelJson: JSON.stringify(
      Object.entries(config.realmUpgradeCosts ?? {}).map(([level, cost_of_level]) => ({
        level: Number(level),
        cost_of_level,
      })),
      null,
      2
    ),
    buildingCategoryJson: "[]",
    startingResourcesJson: JSON.stringify(config.startingResources ?? [], null, 2),
    villageStartingResourcesJson: JSON.stringify(config.villageStartingResources ?? [], null, 2),
    discoverableVillageJson: JSON.stringify(config.discoverableVillageStartingResources ?? [], null, 2),
  };
};

export const ConfigAdminPage = () => {
  const navigate = useNavigate();
  const dojo = useDojo();
  const {
    account: { account },
    setup: { network },
  } = dojo;
  const provider = network.provider as any; // EternumProvider with batch support

  // Load config from the config folder
  const eternumConfig = useMemo(() => ETERNUM_CONFIG(), []);

  // Single state object for all config
  const [configState, setConfigState] = useState<AdminConfigState>(() =>
    initializeConfigState(eternumConfig, account?.address ?? "")
  );

  // Transaction state
  const [tx, setTx] = useState<TxState>({ status: "idle" });

  // Helper to update config state
  const updateConfig = <K extends keyof AdminConfigState>(key: K, value: AdminConfigState[K]) => {
    setConfigState((prev) => ({ ...prev, [key]: value }));
  };

  // Reset to defaults
  const resetDraft = () => {
    setConfigState(initializeConfigState(eternumConfig, account?.address ?? ""));
  };

  // Queue and run batch config - REFACTORED to use config.ts patterns
  const queueAndRun = async () => {
    if (!provider || !account) return;
    setTx({ status: "running" });

    console.log("=".repeat(80));
    console.log("🚀 DEPLOYING ALL CONFIG - Starting batch deployment");
    console.log("🎯 Using config.ts-style wrapper functions for consistency");
    console.log("=".repeat(80));

    try {
      await provider.beginBatch({ signer: account });

      // Build the config context object (matches config/deployer/config.ts interface)
      const configCtx = {
        account,
        provider,
        config: eternumConfig,
      };

      // Execute all config calls using ACTUAL functions from config/deployer/config.ts
      console.log("\n📍 Config 1: World Configuration");
      // @ts-expect-error
      await setWorldConfig(configCtx);

      console.log("\n📍 Config 2: Game Mode Configuration");
      // @ts-expect-error
      await setGameModeConfig(configCtx);

      console.log("\n📍 Config 3: Blitz Previous Game");
      // @ts-expect-error
      await setBlitzPreviousGame(configCtx);

      console.log("\n📍 Config 4: Victory Points Configuration");
      // @ts-expect-error
      await setVictoryPointsConfig(configCtx);

      console.log("\n📍 Config 5: Discoverable Village Spawn Resources");
      // @ts-expect-error
      await setDiscoverableVillageSpawnResourcesConfig(configCtx);

      console.log("\n📍 Config 6: Blitz Registration");
      // @ts-expect-error
      await setBlitzRegistrationConfig(configCtx);

      console.log("\n📍 Config 7: Wonder Bonus Configuration");
      // @ts-expect-error
      await setWonderBonusConfig(configCtx);

      console.log("\n📍 Config 8: Agent Configuration");
      // @ts-expect-error
      await setAgentConfig(configCtx);

      console.log("\n📍 Config 9: Village Controllers Configuration");
      // @ts-expect-error
      await setVillageControllersConfig(configCtx);

      console.log("\n📍 Config 10: Trade Configuration");
      // @ts-expect-error
      await setTradeConfig(configCtx);

      console.log("\n📍 Config 11: Season Configuration");
      // @ts-expect-error
      await setSeasonConfig(configCtx);

      console.log("\n📍 Config 12: VRF Configuration");
      // @ts-expect-error
      await setVRFConfig(configCtx);

      console.log("\n📍 Config 13: Bridge Fees Configuration");
      // @ts-expect-error
      await setResourceBridgeFeesConfig(configCtx);

      console.log("\n📍 Config 14: Battle Configuration");
      // @ts-expect-error
      await setBattleConfig(configCtx);

      console.log("\n📍 Config 15: Structure Max Level Configuration");
      // @ts-expect-error
      await setStructureMaxLevelConfig(configCtx);

      console.log("\n📍 Config 16: Global Configurations (Bank, Tick, Map, Quest)");
      // @ts-expect-error
      await setupGlobals(configCtx);

      console.log("\n📍 Config 17: Capacity Configuration");
      // @ts-expect-error
      await setCapacityConfig(configCtx);

      console.log("\n📍 Config 18: Speed Configuration");
      // @ts-expect-error
      await setSpeedConfig(configCtx);

      console.log("\n📍 Config 19: Hyperstructure Configuration");
      // @ts-expect-error
      await setHyperstructureConfig(configCtx);

      console.log("\n📍 Config 20: Settlement Configuration");
      // @ts-expect-error
      await setSettlementConfig(configCtx);

      console.log("\n📍 Config 21: Starting Resources Configuration");
      // @ts-expect-error
      await setStartingResourcesConfig(configCtx);

      console.log("\n📍 Config 22: Weight Configuration");
      // @ts-expect-error
      await setWeightConfig(configCtx);

      console.log("\n📍 Config 23: Realm Upgrade Configuration");
      // @ts-expect-error
      await setRealmUpgradeConfig(configCtx);

      console.log("\n📍 Config 24: Troop Configuration");
      // @ts-expect-error
      await setTroopConfig(configCtx);

      console.log("\n📍 Config 25: Building Configuration");
      // @ts-expect-error
      await setBuildingConfig(configCtx);

      console.log("\n📍 Config 26: Resource Factory Configuration");
      // @ts-expect-error
      await SetResourceFactoryConfig(configCtx);

      console.log("\n📍 Config 27: Resource Bridge Whitelist Configuration");
      // @ts-expect-error
      await setResourceBridgeWtlConfig(configCtx);

      console.log("=".repeat(80));
      console.log("✅ All configs queued - executing batch transaction...");
      console.log("=".repeat(80));

      const receipt = await provider.endBatch({ flush: true });

      console.log("=".repeat(80));
      console.log("🎉 BATCH DEPLOYMENT COMPLETE!");
      console.log("Transaction Hash:", receipt?.transaction_hash);
      console.log("=".repeat(80));

      setTx({ status: "success", hash: receipt?.transaction_hash });
    } catch (e: any) {

      console.log("=".repeat(80));
      console.error("❌ BATCH DEPLOYMENT FAILED!");
      console.error("Error:", e?.message ?? String(e));
      console.error("Full error:", e);
      console.log("=".repeat(80));

      // Check if it was a user cancellation
      const errorMessage = e?.message ?? String(e);
      const isCancelled = errorMessage.toLowerCase().includes("cancel") ||
                         errorMessage.toLowerCase().includes("reject") ||
                         errorMessage.toLowerCase().includes("denied") ||
                         errorMessage.toLowerCase().includes("timeout");

      const displayError = isCancelled
        ? "Transaction cancelled by user"
        : errorMessage;

      // Always set error state first to unblock UI
      setTx({ status: "error", error: displayError });

      // Try to cancel the batch (non-blocking) - with timeout
      try {
        await Promise.race([
          provider.endBatch({ flush: false }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Cancel timeout")), 2000))
        ]);
      } catch (cancelError) {
        console.warn("Failed to cancel batch (this is expected if tx was cancelled):", cancelError);
      }
    }
  };

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  // Config sections with metadata
  const configSections = [
    { key: "world", title: "World Configuration", icon: Server, color: "blue" },
    { key: "season", title: "Season Configuration", icon: Clock, color: "purple" },
    { key: "capacity", title: "Capacity Settings", icon: Database, color: "green" },
    { key: "victory_points", title: "Victory Points", icon: Trophy, color: "yellow" },
    { key: "agent", title: "Agent Configuration", icon: Users, color: "pink" },
    { key: "vrf", title: "VRF Configuration", icon: Zap, color: "orange" },
    { key: "bridge_fees", title: "Bridge Fees", icon: Coins, color: "emerald" },
    { key: "village_token", title: "Village Token", icon: Sparkles, color: "cyan" },
    { key: "wonder_bonus", title: "Wonder Bonus", icon: Shield, color: "indigo" },
    { key: "battle", title: "Battle Configuration", icon: Shield, color: "red" },
    { key: "tick", title: "Tick Configuration", icon: Activity, color: "teal" },
    { key: "bank", title: "Bank Configuration", icon: Coins, color: "amber" },
    { key: "game_mode", title: "Game Mode", icon: Settings, color: "slate" },
    { key: "map", title: "Map & Exploration", icon: Map, color: "lime" },
    { key: "trade", title: "Trade Configuration", icon: Coins, color: "sky" },
    { key: "donkey_speed", title: "Speed Settings", icon: Zap, color: "violet" },
  ];

  const filteredSections = configSections.filter((section) =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-[#0a0a0f] via-[#121218] to-[#0f0f14] text-white overflow-y-scroll overflow-x-hidden">
      {/* Premium Header */}
      <div className="top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Title Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-gold/20 to-orange/20 rounded-2xl border border-gold/30 shadow-lg">
                <Cog className="w-8 h-8 text-gold animate-spin-slow" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gold via-yellow-300 to-gold bg-clip-text text-transparent">
                  Admin Control Center
                </h1>
                <p className="text-white/60 text-xs mt-1">
                  Centralized configuration management for Eternum
                </p>
              </div>
            </div>

            {/* Status Indicator and Connect Button */}
            <div className="flex items-center gap-3">
              <Controller className="bg-gradient-to-br from-gold/20 to-orange/20 border-gold/30 hover:from-gold/30 hover:to-orange/30" />
              <Button
                variant="outline"
                onClick={() => navigate("/config-admin/factory")}
                className="flex items-center gap-2 text-xs"
              >
                <Factory className="w-4 h-4" />
                Factory Setup
              </Button>
              {tx.status === "idle" && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  <span className="text-xs text-white/70">Ready</span>
                </div>
              )}
              {tx.status === "running" && (
                <div className="flex items-center gap-2 px-4 py-2 bg-orange/20 rounded-xl border border-orange/30">
                  <div className="w-2 h-2 bg-orange rounded-full animate-pulse" />
                  <span className="text-xs text-orange">Processing...</span>
                </div>
              )}
              {tx.status === "success" && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green/20 rounded-xl border border-green/30">
                  <CheckCircle2 className="w-4 h-4 text-green" />
                  <span className="text-xs text-green">Success</span>
                </div>
              )}
              {tx.status === "error" && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red/20 rounded-xl border border-red/30">
                  <XCircle className="w-4 h-4 text-red" />
                  <span className="text-xs text-red">Error</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg p-3 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-green-300/70 uppercase tracking-wider mb-1">Total Configs</p>
                  <p className="text-xl font-bold text-green-300">{configSections.length}</p>
                </div>
                <Database className="w-6 h-6 text-green-400/30" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-gold/10 to-orange/5 border border-gold/20 rounded-lg p-3 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gold/70 uppercase tracking-wider mb-1">Status</p>
                  <p className="text-base font-bold text-gold">{tx.status.toUpperCase()}</p>
                </div>
                <Activity className="w-6 h-6 text-gold/30" />
              </div>
            </div>
          </div> */}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* <div className="flex-1 w-full relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="text"
                placeholder="Search configurations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all"
              />
            </div> */}

            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="gold"
                size="md"
                onClick={tx.status === "running" ? () => setTx({ status: "idle" }) : queueAndRun}
                isLoading={tx.status === "running"}
                className="flex-1 sm:flex-initial shadow-lg shadow-gold/20 hover:shadow-gold/40"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Deploy Config
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={resetDraft}
                disabled={tx.status === "running"}
                className="flex-1 sm:flex-initial"
              >
                Reset All
              </Button>
            </div>
          </div>

          {/* Transaction Feedback */}
          {tx.status === "success" && tx.hash && (
            <div className="mt-4 p-4 bg-green/10 border border-green/30 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green mb-1">Transaction Successful</p>
                <p className="text-xs text-green/70 font-mono truncate">{tx.hash}</p>
              </div>
            </div>
          )}

          {tx.status === "error" && tx.error && (
            <div className="mt-4 p-4 bg-red/10 border border-red/30 rounded-xl">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red mb-1">Transaction Failed</p>
                  <p className="text-xs text-red/70">{tx.error}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setTx({ status: "idle" })}
                  className="border-red/30 text-red hover:bg-red/10"
                >
                  Dismiss
                </Button>
                <Button
                  variant="gold"
                  size="xs"
                  onClick={queueAndRun}
                  className="shadow-sm"
                >
                  Retry Deployment
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Config Sections */}
        <div className="space-y-4">
          {/* World + Mercenaries */}
          <section
            id="section-world"
            className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all duration-300"
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
                  <Server className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">World Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Global world and mercenaries settings</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Admin Address</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    value={configState.worldAdminAddress}
                    onChange={(e) => updateConfig("worldAdminAddress", e.target.value)}
                    placeholder="0x..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Mercenaries Name (hex felt)
                  </label>
                  <input
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono"
                    value={configState.mercenariesNameHex}
                    onChange={(e) => updateConfig("mercenariesNameHex", e.target.value)}
                    placeholder="0x..."
                  />
                  {configState.mercenariesNameHex && hexToAscii(configState.mercenariesNameHex) && (
                    <div className="mt-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <span className="text-xs text-blue-300/70">ASCII: </span>
                      <span className="text-sm text-blue-200 font-medium">{hexToAscii(configState.mercenariesNameHex)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Season Config */}
          <section
            id="section-season"
            className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all duration-300"
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Season Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Season timing and contract addresses</p>
                </div>
              </div>
              <div className="space-y-4">
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      Contract Addresses
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Season Pass</label>
                        <input
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          value={configState.seasonPassAddress}
                          onChange={(e) => updateConfig("seasonPassAddress", e.target.value)}
                          placeholder="0x..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Realms Address</label>
                        <input
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          value={configState.realmsAddress}
                          onChange={(e) => updateConfig("realmsAddress", e.target.value)}
                          placeholder="0x..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Lords Address</label>
                        <input
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          value={configState.lordsAddress}
                          onChange={(e) => updateConfig("lordsAddress", e.target.value)}
                          placeholder="0x..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-clock-500/5 border border-white/10 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-purple-300 mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Season Timing
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Start Settling At</label>
                        <input
                          type="number"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          value={configState.seasonStartSettlingAt}
                          onChange={(e) => updateConfig("seasonStartSettlingAt", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Start Main At</label>
                        <input
                          type="number"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          value={configState.seasonStartMainAt}
                          onChange={(e) => updateConfig("seasonStartMainAt", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">End At</label>
                        <input
                          type="number"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          value={configState.seasonEndAt}
                          onChange={(e) => updateConfig("seasonEndAt", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Bridge Close After End (sec)
                        </label>
                        <input
                          type="number"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          value={configState.seasonBridgeCloseAfterEnd}
                          onChange={(e) => updateConfig("seasonBridgeCloseAfterEnd", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Point Registration Grace (sec)
                        </label>
                        <input
                          type="number"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                          value={configState.seasonPointRegistrationGrace}
                          onChange={(e) => updateConfig("seasonPointRegistrationGrace", Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </section>

          {/* Capacity Config */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-slate-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-600/10 border border-slate-500/30">
                  <Database className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Capacity Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Storage and transport capacity limits</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-300/70 mb-1 block">Realm Capacity</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-slate-300 outline-none ring-1 ring-slate-500/20 focus:ring-slate-500/50"
                    value={configState.realmCapacity}
                    onChange={(e) => updateConfig("realmCapacity", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300/70 mb-1 block">Village Capacity</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-slate-300 outline-none ring-1 ring-slate-500/20 focus:ring-slate-500/50"
                    value={configState.villageCapacity}
                    onChange={(e) => updateConfig("villageCapacity", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300/70 mb-1 block">Hyperstructure Capacity</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-slate-300 outline-none ring-1 ring-slate-500/20 focus:ring-slate-500/50"
                    value={configState.hyperstructureCapacity}
                    onChange={(e) => updateConfig("hyperstructureCapacity", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300/70 mb-1 block">Fragment Mine Capacity</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-slate-300 outline-none ring-1 ring-slate-500/20 focus:ring-slate-500/50"
                    value={configState.fragmentMineCapacity}
                    onChange={(e) => updateConfig("fragmentMineCapacity", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300/70 mb-1 block">Bank Structure Capacity</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-slate-300 outline-none ring-1 ring-slate-500/20 focus:ring-slate-500/50"
                    value={configState.bankStructureCapacity}
                    onChange={(e) => updateConfig("bankStructureCapacity", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300/70 mb-1 block">Troop Capacity</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-slate-300 outline-none ring-1 ring-slate-500/20 focus:ring-slate-500/50"
                    value={configState.troopCapacity}
                    onChange={(e) => updateConfig("troopCapacity", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300/70 mb-1 block">Donkey Capacity</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-slate-300 outline-none ring-1 ring-slate-500/20 focus:ring-slate-500/50"
                    value={configState.donkeyCapacity}
                    onChange={(e) => updateConfig("donkeyCapacity", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300/70 mb-1 block">Storehouse Boost Capacity</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-slate-300 outline-none ring-1 ring-slate-500/20 focus:ring-slate-500/50"
                    value={configState.storehouseBoostCapacity}
                    onChange={(e) => updateConfig("storehouseBoostCapacity", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Trade & Speed */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-sky-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500/20 to-sky-600/10 border border-sky-500/30">
                  <Zap className="w-5 h-5 text-sky-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Trade & Speed Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Trading limits and transport speed</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-sky-300/70 mb-1 block">Trade Max Count</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-sky-300 outline-none ring-1 ring-sky-500/20 focus:ring-sky-500/50"
                    value={configState.tradeMaxCount}
                    onChange={(e) => updateConfig("tradeMaxCount", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-sky-300/70 mb-1 block">Donkey Speed (sec per km)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-sky-300 outline-none ring-1 ring-sky-500/20 focus:ring-sky-500/50"
                    value={configState.donkeySecPerKm}
                    onChange={(e) => updateConfig("donkeySecPerKm", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Victory Points */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Victory Points Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Scoring system and win conditions</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-amber-300/70 mb-1 block">Points For Win</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-amber-300 outline-none ring-1 ring-amber-500/20 focus:ring-amber-500/50"
                    value={configState.pointsForWin}
                    onChange={(e) => updateConfig("pointsForWin", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-amber-300/70 mb-1 block">Hyps Points Per Second</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-amber-300 outline-none ring-1 ring-amber-500/20 focus:ring-amber-500/50"
                    value={configState.hypsPointsPerSecond}
                    onChange={(e) => updateConfig("hypsPointsPerSecond", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-amber-300/70 mb-1 block">Hyps Claim vs Bandits Points</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-amber-300 outline-none ring-1 ring-amber-500/20 focus:ring-amber-500/50"
                    value={configState.hypsClaimVsBanditsPoints}
                    onChange={(e) => updateConfig("hypsClaimVsBanditsPoints", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-amber-300/70 mb-1 block">Non-Hyps Claim vs Bandits Points</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-amber-300 outline-none ring-1 ring-amber-500/20 focus:ring-amber-500/50"
                    value={configState.nonHypsClaimVsBanditsPoints}
                    onChange={(e) => updateConfig("nonHypsClaimVsBanditsPoints", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-amber-300/70 mb-1 block">Tile Exploration Points</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-amber-300 outline-none ring-1 ring-amber-500/20 focus:ring-amber-500/50"
                    value={configState.tileExplorationPoints}
                    onChange={(e) => updateConfig("tileExplorationPoints", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Agent Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-violet-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/30">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Agent Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Agent controller and spawn settings</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-xs text-violet-300/70 mb-1 block">Controller Address</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-violet-300 outline-none ring-1 ring-violet-500/20 focus:ring-violet-500/50 font-mono"
                    value={configState.agentControllerAddress}
                    onChange={(e) => updateConfig("agentControllerAddress", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-violet-300/70 mb-1 block">Max Lifetime Count</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-violet-300 outline-none ring-1 ring-violet-500/20 focus:ring-violet-500/50"
                    value={configState.agentMaxLifetime}
                    onChange={(e) => updateConfig("agentMaxLifetime", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-violet-300/70 mb-1 block">Max Current Count</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-violet-300 outline-none ring-1 ring-violet-500/20 focus:ring-violet-500/50"
                    value={configState.agentMaxCurrent}
                    onChange={(e) => updateConfig("agentMaxCurrent", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-violet-300/70 mb-1 block">Min Spawn Lords Amount</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-violet-300 outline-none ring-1 ring-violet-500/20 focus:ring-violet-500/50"
                    value={configState.agentMinSpawn}
                    onChange={(e) => updateConfig("agentMinSpawn", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-violet-300/70 mb-1 block">Max Spawn Lords Amount</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-violet-300 outline-none ring-1 ring-violet-500/20 focus:ring-violet-500/50"
                    value={configState.agentMaxSpawn}
                    onChange={(e) => updateConfig("agentMaxSpawn", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* VRF Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">VRF Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Verifiable Random Function provider settings</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-indigo-300/70 mb-1 block">VRF Provider Address</label>
                <input
                  className="w-full rounded bg-black/30 px-3 py-2 text-sm text-indigo-300 outline-none ring-1 ring-indigo-500/20 focus:ring-indigo-500/50 font-mono"
                  value={configState.vrfProviderAddress}
                  onChange={(e) => updateConfig("vrfProviderAddress", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Bridge Fees Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Bridge Fees Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Configure bridge fee percentages and recipients</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Velords Fee on Deposit (%)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50"
                    value={configState.rbVelordsFeeDpt}
                    onChange={(e) => updateConfig("rbVelordsFeeDpt", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Velords Fee on Withdrawal (%)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50"
                    value={configState.rbVelordsFeeWtdr}
                    onChange={(e) => updateConfig("rbVelordsFeeWtdr", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Velords Recipient</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50 font-mono"
                    value={configState.rbVelordsRecipient}
                    onChange={(e) => updateConfig("rbVelordsRecipient", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Season Pool Fee on Deposit (%)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50"
                    value={configState.rbSeasonPoolFeeDpt}
                    onChange={(e) => updateConfig("rbSeasonPoolFeeDpt", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Season Pool Fee on Withdrawal (%)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50"
                    value={configState.rbSeasonPoolFeeWtdr}
                    onChange={(e) => updateConfig("rbSeasonPoolFeeWtdr", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Season Pool Recipient</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50 font-mono"
                    value={configState.rbSeasonPoolRecipient}
                    onChange={(e) => updateConfig("rbSeasonPoolRecipient", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Client Fee on Deposit (%)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50"
                    value={configState.rbClientFeeDpt}
                    onChange={(e) => updateConfig("rbClientFeeDpt", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Client Fee on Withdrawal (%)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50"
                    value={configState.rbClientFeeWtdr}
                    onChange={(e) => updateConfig("rbClientFeeWtdr", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Realm Fee on Deposit (%)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50"
                    value={configState.rbRealmFeeDpt}
                    onChange={(e) => updateConfig("rbRealmFeeDpt", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-300/70 mb-1 block">Realm Fee on Withdrawal (%)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-blue-300 outline-none ring-1 ring-blue-500/20 focus:ring-blue-500/50"
                    value={configState.rbRealmFeeWtdr}
                    onChange={(e) => updateConfig("rbRealmFeeWtdr", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Village Token Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-teal-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-600/10 border border-teal-500/30">
                  <Map className="w-5 h-5 text-teal-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Village Token Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Village pass NFT and mint settings</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-teal-300/70 mb-1 block">Village Pass NFT Address</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-teal-300 outline-none ring-1 ring-teal-500/20 focus:ring-teal-500/50 font-mono"
                    value={configState.villagePassNftAddress}
                    onChange={(e) => updateConfig("villagePassNftAddress", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-teal-300/70 mb-1 block">Village Mint Initial Recipient</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-teal-300 outline-none ring-1 ring-teal-500/20 focus:ring-teal-500/50 font-mono"
                    value={configState.villageMintInitialRecipient}
                    onChange={(e) => updateConfig("villageMintInitialRecipient", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Wonder Bonus Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-yellow-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30">
                  <Star className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Wonder Bonus Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Wonder tile proximity bonus settings</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-yellow-300/70 mb-1 block">Within Tile Distance</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-yellow-300 outline-none ring-1 ring-yellow-500/20 focus:ring-yellow-500/50"
                    value={configState.wonderTileDistance}
                    onChange={(e) => updateConfig("wonderTileDistance", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-yellow-300/70 mb-1 block">Bonus Percent Numerator</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-yellow-300 outline-none ring-1 ring-yellow-500/20 focus:ring-yellow-500/50"
                    value={configState.wonderBonusPercentNum}
                    onChange={(e) => updateConfig("wonderBonusPercentNum", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Battle Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-red-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30">
                  <Swords className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Battle Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Battle grace period settings</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-red-300/70 mb-1 block">Grace Tick Count (Regular)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-red-300 outline-none ring-1 ring-red-500/20 focus:ring-red-500/50"
                    value={configState.battleGraceTicks}
                    onChange={(e) => updateConfig("battleGraceTicks", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-red-300/70 mb-1 block">Grace Tick Count (Hyperstructure)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-red-300 outline-none ring-1 ring-red-500/20 focus:ring-red-500/50"
                    value={configState.battleGraceTicksHyp}
                    onChange={(e) => updateConfig("battleGraceTicksHyp", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Tick Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-pink-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-600/10 border border-pink-500/30">
                  <Clock className="w-5 h-5 text-pink-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Tick Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Game tick and delivery intervals</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-pink-300/70 mb-1 block">Tick Interval (seconds)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-pink-300 outline-none ring-1 ring-pink-500/20 focus:ring-pink-500/50"
                    value={configState.tickIntervalSeconds}
                    onChange={(e) => updateConfig("tickIntervalSeconds", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-pink-300/70 mb-1 block">Delivery Tick Interval (seconds)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-pink-300 outline-none ring-1 ring-pink-500/20 focus:ring-pink-500/50"
                    value={configState.deliveryTickIntervalSeconds}
                    onChange={(e) => updateConfig("deliveryTickIntervalSeconds", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Bank Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-green-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30">
                  <Coins className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Bank Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Liquidity provider and owner fee settings</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-green-300/70 mb-1 block">LP Fee Numerator</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-green-300 outline-none ring-1 ring-green-500/20 focus:ring-green-500/50"
                    value={configState.bankLpFeeNum}
                    onChange={(e) => updateConfig("bankLpFeeNum", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-green-300/70 mb-1 block">LP Fee Denominator</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-green-300 outline-none ring-1 ring-green-500/20 focus:ring-green-500/50"
                    value={configState.bankLpFeeDenom}
                    onChange={(e) => updateConfig("bankLpFeeDenom", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-green-300/70 mb-1 block">Owner Fee Numerator</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-green-300 outline-none ring-1 ring-green-500/20 focus:ring-green-500/50"
                    value={configState.bankOwnerFeeNum}
                    onChange={(e) => updateConfig("bankOwnerFeeNum", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-green-300/70 mb-1 block">Owner Fee Denominator</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-green-300 outline-none ring-1 ring-green-500/20 focus:ring-green-500/50"
                    value={configState.bankOwnerFeeDenom}
                    onChange={(e) => updateConfig("bankOwnerFeeDenom", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Game Mode (Blitz) */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-orange-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30">
                  <Zap className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Game Mode (Blitz)</h2>
                  <p className="text-xs text-white/50 mt-0.5">Enable fast-paced game mode</p>
                </div>
              </div>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded bg-black/30 border border-orange-500/20 focus:ring-2 focus:ring-orange-500/50 text-orange-500 cursor-pointer"
                    checked={configState.blitzModeOn}
                    onChange={(e) => updateConfig("blitzModeOn", e.target.checked)}
                  />
                  <span className="text-sm text-orange-300">Blitz Mode Enabled</span>
                </label>
                <div>
                  <label className="text-xs text-orange-300/70 mb-1 block">Previous Game Prize Distribution Address</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-orange-300 outline-none ring-1 ring-orange-500/20 focus:ring-orange-500/50 font-mono"
                    value={configState.blitzPrevGameAddress}
                    onChange={(e) => updateConfig("blitzPrevGameAddress", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Blitz Registration Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-fuchsia-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/10 border border-fuchsia-500/30">
                  <Users className="w-5 h-5 text-fuchsia-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Blitz Registration Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Player registration settings for Blitz mode</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Fee Token Address</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50 font-mono"
                    value={configState.blitzRegFeeToken}
                    onChange={(e) => updateConfig("blitzRegFeeToken", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Fee Recipient Address</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50 font-mono"
                    value={configState.blitzRegFeeRecipient}
                    onChange={(e) => updateConfig("blitzRegFeeRecipient", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Fee Amount</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50"
                    value={configState.blitzRegFeeAmount}
                    onChange={(e) => updateConfig("blitzRegFeeAmount", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Max Registration Count</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50"
                    value={configState.blitzRegCountMax}
                    onChange={(e) => updateConfig("blitzRegCountMax", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Registration Delay (seconds)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50"
                    value={configState.blitzRegDelaySeconds}
                    onChange={(e) => updateConfig("blitzRegDelaySeconds", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Registration Period (seconds)</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50"
                    value={configState.blitzRegPeriodSeconds}
                    onChange={(e) => updateConfig("blitzRegPeriodSeconds", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Entry Token Class Hash</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50 font-mono"
                    value={configState.blitzRegEntryTokenClassHash}
                    onChange={(e) => updateConfig("blitzRegEntryTokenClassHash", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Entry Token IPFS CID</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50 font-mono"
                    value={configState.blitzRegEntryTokenIpfsCid}
                    onChange={(e) => updateConfig("blitzRegEntryTokenIpfsCid", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Max Collectible Cosmetics</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50"
                    value={configState.blitzRegCollectibleCosmeticsMax}
                    onChange={(e) => updateConfig("blitzRegCollectibleCosmeticsMax", Number(e.target.value))}
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Cosmetics Contract Address</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50 font-mono"
                    value={configState.blitzRegCollectibleCosmeticsAddress}
                    onChange={(e) => updateConfig("blitzRegCollectibleCosmeticsAddress", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Timelock Contract Address</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50 font-mono"
                    value={configState.blitzRegCollectibleTimelockAddress}
                    onChange={(e) => updateConfig("blitzRegCollectibleTimelockAddress", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="text-xs text-fuchsia-300/70 mb-1 block">Loot Chest Contract Address</label>
                  <input
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-fuchsia-300 outline-none ring-1 ring-fuchsia-500/20 focus:ring-fuchsia-500/50 font-mono"
                    value={configState.blitzRegCollectiblesLootchestAddress}
                    onChange={(e) => updateConfig("blitzRegCollectiblesLootchestAddress", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Hyperstructure Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30">
                  <Shield className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Hyperstructure Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Hyperstructure initialization and construction costs</p>
                </div>
                <div className="px-3 py-1.5 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                  <span className="text-sm font-semibold text-cyan-300">
                    {(() => {
                      try {
                        return JSON.parse(configState.hypConstructionResourcesJson).length + " Resources";
                      } catch {
                        return "Error";
                      }
                    })()}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-cyan-300/70 mb-1 block">Initialize Shards Amount</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-cyan-300 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50"
                    value={configState.hypInitializeShardsAmount || 0}
                    onChange={(e) => updateConfig("hypInitializeShardsAmount", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-cyan-300/70 mb-2 block">Construction Resources</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                    {(() => {
                      try {
                        const resources = JSON.parse(configState.hypConstructionResourcesJson);
                        return resources.map((item: any, idx: number) => (
                          <div key={idx} className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-3 hover:bg-cyan-500/[0.15] transition-colors">
                            <div className="mb-2 pb-2 border-b border-cyan-500/20 flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-cyan-200">{getResourceName(item.resource_type)}</div>
                                <div className="text-[10px] text-cyan-300/50">ID: {item.resource_type}</div>
                              </div>
                              <div className="relative group/help">
                                <HelpCircle className="w-3.5 h-3.5 text-cyan-400/50 hover:text-cyan-400 cursor-help transition-colors" />
                                <div className="absolute right-0 top-6 hidden group-hover/help:block z-50 w-64 max-h-64 overflow-y-auto bg-black/95 border border-cyan-500/30 rounded-lg p-2 shadow-xl">
                                  <div className="text-[10px] font-semibold text-cyan-300 mb-1.5 sticky top-0 bg-black/95 pb-1">All Resources:</div>
                                  <div className="space-y-0.5">
                                    {getAllResources().map((res) => (
                                      <div key={res.id} className="text-[10px] text-white/70 hover:text-white hover:bg-cyan-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors" onClick={() => {
                                        const newResources = [...resources];
                                        newResources[idx] = { ...item, resource_type: res.id };
                                        updateConfig("hypConstructionResourcesJson", JSON.stringify(newResources, null, 2));
                                      }}>
                                        {res.id}: {res.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="text-xs text-cyan-300/70 mb-1 block">Resource Type</label>
                                <select
                                  className="w-full rounded bg-black/30 px-2 py-1 text-sm text-cyan-300 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50 cursor-pointer"
                                  value={item.resource_type || 0}
                                  onChange={(e) => {
                                    const newResources = [...resources];
                                    newResources[idx] = { ...item, resource_type: Number(e.target.value) };
                                    updateConfig("hypConstructionResourcesJson", JSON.stringify(newResources, null, 2));
                                  }}
                                >
                                  {getAllResources().map((res) => (
                                    <option key={res.id} value={res.id}>
                                      {res.id}: {res.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-cyan-300/70 mb-1 block">Completion Points</label>
                                <input
                                  type="number"
                                  className="w-full rounded bg-black/30 px-2 py-1 text-sm text-cyan-300 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50"
                                  value={item.resource_completion_points || 0}
                                  onChange={(e) => {
                                    const newResources = [...resources];
                                    newResources[idx] = { ...item, resource_completion_points: Number(e.target.value) };
                                    updateConfig("hypConstructionResourcesJson", JSON.stringify(newResources, null, 2));
                                  }}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-cyan-300/70 mb-1 block">Min Amount</label>
                                  <input
                                    type="number"
                                    className="w-full rounded bg-black/30 px-2 py-1 text-sm text-cyan-300 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50"
                                    value={item.min_amount || 0}
                                    onChange={(e) => {
                                      const newResources = [...resources];
                                      newResources[idx] = { ...item, min_amount: Number(e.target.value) };
                                      updateConfig("hypConstructionResourcesJson", JSON.stringify(newResources, null, 2));
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-cyan-300/70 mb-1 block">Max Amount</label>
                                  <input
                                    type="number"
                                    className="w-full rounded bg-black/30 px-2 py-1 text-sm text-cyan-300 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50"
                                    value={item.max_amount || 0}
                                    onChange={(e) => {
                                      const newResources = [...resources];
                                      newResources[idx] = { ...item, max_amount: Number(e.target.value) };
                                      updateConfig("hypConstructionResourcesJson", JSON.stringify(newResources, null, 2));
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ));
                      } catch (e) {
                        return <div className="col-span-full text-center text-red-400 text-sm p-4">Invalid data format</div>;
                      }
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Settlement Configuration */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
                  <Map className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Settlement Configuration</h2>
                  <p className="text-xs text-white/50 mt-0.5">Settlement spatial layout and distance settings</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-emerald-300/70 mb-1 block">Center X Coordinate</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-emerald-300 outline-none ring-1 ring-emerald-500/20 focus:ring-emerald-500/50"
                    value={configState.settlementCenterX}
                    onChange={(e) => updateConfig("settlementCenterX", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-emerald-300/70 mb-1 block">Center Y Coordinate</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-emerald-300 outline-none ring-1 ring-emerald-500/20 focus:ring-emerald-500/50"
                    value={configState.settlementCenterY}
                    onChange={(e) => updateConfig("settlementCenterY", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-emerald-300/70 mb-1 block">Base Distance</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-emerald-300 outline-none ring-1 ring-emerald-500/20 focus:ring-emerald-500/50"
                    value={configState.settlementBaseDistance}
                    onChange={(e) => updateConfig("settlementBaseDistance", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-emerald-300/70 mb-1 block">Subsequent Distance</label>
                  <input
                    type="number"
                    className="w-full rounded bg-black/30 px-3 py-2 text-sm text-emerald-300 outline-none ring-1 ring-emerald-500/20 focus:ring-emerald-500/50"
                    value={configState.settlementSubsequentDistance}
                    onChange={(e) => updateConfig("settlementSubsequentDistance", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Map/Exploration Configuration */}
          <section id="section-map" className="rounded-lg border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Map/Exploration Configuration</h2>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-white/60">Map Reward Amount</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.mapRewardAmount}
                  onChange={(e) => updateConfig("mapRewardAmount", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Shards Mines Win Probability</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.shardsMinesWinProb}
                  onChange={(e) => updateConfig("shardsMinesWinProb", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Shards Mines Fail Probability</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.shardsMinesFailProb}
                  onChange={(e) => updateConfig("shardsMinesFailProb", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Agent Find Probability</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.agentFindProb}
                  onChange={(e) => updateConfig("agentFindProb", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Agent Find Fail Probability</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.agentFindFailProb}
                  onChange={(e) => updateConfig("agentFindFailProb", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Village Find Probability</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.villageFindProb}
                  onChange={(e) => updateConfig("villageFindProb", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Village Find Fail Probability</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.villageFindFailProb}
                  onChange={(e) => updateConfig("villageFindFailProb", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Hyps Win Prob At Center</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.hypsWinProb}
                  onChange={(e) => updateConfig("hypsWinProb", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Hyps Fail Prob At Center</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.hypsFailProb}
                  onChange={(e) => updateConfig("hypsFailProb", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Hyps Fail Prob Increase Per Hex</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.hypsFailProbIncreaseHex}
                  onChange={(e) => updateConfig("hypsFailProbIncreaseHex", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Hyps Fail Prob Increase Per Found</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.hypsFailProbIncreaseFound}
                  onChange={(e) => updateConfig("hypsFailProbIncreaseFound", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Relic Discovery Interval (sec)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.relicDiscoveryInterval}
                  onChange={(e) => updateConfig("relicDiscoveryInterval", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Relic Hex Distance From Center</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.relicHexDist}
                  onChange={(e) => updateConfig("relicHexDist", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Relic Chest Relics Per Chest</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.relicChestRelicsPerChest}
                  onChange={(e) => updateConfig("relicChestRelicsPerChest", Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          {/* Structure Levels */}
          <section className="rounded-lg border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Structure Level Configuration</h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/60">Realm Max Level</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.realmMaxLevel}
                  onChange={(e) => updateConfig("realmMaxLevel", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Village Max Level</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded bg-white/5 p-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/30"
                  value={configState.villageMaxLevel}
                  onChange={(e) => updateConfig("villageMaxLevel", Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          {/* Resource Weights */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
                  <Coins className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Resource Weights</h2>
                  <p className="text-xs text-white/50 mt-0.5">Weight values (in nanograms) for each resource type</p>
                </div>
                <div className="px-3 py-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                  <span className="text-sm font-semibold text-emerald-300">
                    {(() => {
                      try {
                        return JSON.parse(configState.weightJson).length + " Resources";
                      } catch {
                        return "Error";
                      }
                    })()}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                {(() => {
                  try {
                    const weights = JSON.parse(configState.weightJson);
                    return weights.map((item: any, idx: number) => (
                      <div key={idx} className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-lg p-3 hover:bg-emerald-500/[0.15] transition-colors">
                        <div className="mb-2 pb-2 border-b border-emerald-500/20 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-emerald-200">{getResourceName(item.entity_type)}</div>
                            <div className="text-[10px] text-emerald-300/50">ID: {item.entity_type}</div>
                          </div>
                          <div className="relative group/help">
                            <HelpCircle className="w-3.5 h-3.5 text-emerald-400/50 hover:text-emerald-400 cursor-help transition-colors" />
                            <div className="absolute right-0 top-6 hidden group-hover/help:block z-50 w-64 max-h-64 overflow-y-auto bg-black/95 border border-emerald-500/30 rounded-lg p-2 shadow-xl">
                              <div className="text-[10px] font-semibold text-emerald-300 mb-1.5 sticky top-0 bg-black/95 pb-1">All Resources:</div>
                              <div className="space-y-0.5">
                                {getAllResources().map((res) => (
                                  <div
                                    key={res.id}
                                    className="text-[10px] text-white/70 hover:text-white hover:bg-emerald-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                    onClick={() => {
                                      const newWeights = [...weights];
                                      newWeights[idx] = { ...item, entity_type: res.id };
                                      updateConfig("weightJson", JSON.stringify(newWeights, null, 2));
                                    }}
                                  >
                                    {res.id}: {res.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-emerald-300/70 mb-1 block">Resource</label>
                            <select
                              className="w-full rounded bg-black/40 px-2 py-1 text-sm text-emerald-300 outline-none ring-1 ring-emerald-500/20 focus:ring-emerald-500/50 cursor-pointer"
                              value={item.entity_type || 0}
                              onChange={(e) => {
                                const newWeights = [...weights];
                                newWeights[idx] = { ...item, entity_type: Number(e.target.value) };
                                updateConfig("weightJson", JSON.stringify(newWeights, null, 2));
                              }}
                            >
                              {getAllResources().map((res) => (
                                <option key={res.id} value={res.id}>
                                  {res.id}: {res.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-emerald-300/70 mb-1 block">Weight (ng)</label>
                            <input
                              type="number"
                              className="w-full rounded bg-black/30 px-2 py-1 text-sm text-emerald-300 outline-none ring-1 ring-emerald-500/20 focus:ring-emerald-500/50"
                              value={item.weight_nanogram || 0}
                              onChange={(e) => {
                                const newWeights = [...weights];
                                newWeights[idx] = { ...item, weight_nanogram: Number(e.target.value) };
                                updateConfig("weightJson", JSON.stringify(newWeights, null, 2));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  } catch (e) {
                    return <div className="col-span-full text-center text-red-400 text-sm p-4">Invalid data format</div>;
                  }
                })()}
              </div>
            </div>
          </section>

          {/* Structure Level Costs */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30">
                  <Cog className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Structure Level Costs</h2>
                  <p className="text-xs text-white/50 mt-0.5">Resource costs required for each realm upgrade level</p>
                </div>
                <div className="px-3 py-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
                  <span className="text-sm font-semibold text-purple-300">
                    {(() => {
                      try {
                        return JSON.parse(configState.structureLevelJson).length + " Levels";
                      } catch {
                        return "Error";
                      }
                    })()}
                  </span>
                </div>
              </div>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {(() => {
                  try {
                    const levels = JSON.parse(configState.structureLevelJson);
                    return levels.map((item: any, levelIdx: number) => {
                      const costs = Array.isArray(item.cost_of_level) ? item.cost_of_level : [];
                      return (
                        <div key={levelIdx} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.08] transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-purple-300">Level {item.level}</span>
                              <span className="px-2 py-0.5 bg-purple-500/20 rounded text-xs text-purple-300">
                                {costs.length} {costs.length === 1 ? 'Resource' : 'Resources'}
                              </span>
                            </div>
                          </div>
                          {costs.length === 0 ? (
                            <div className="text-xs text-white/50 italic">No costs required</div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {costs.map((cost: any, costIdx: number) => (
                                <div key={costIdx} className="bg-black/30 rounded-lg p-3 border border-purple-500/20 hover:border-purple-500/40 transition-colors group">
                                  <div className="mb-2 pb-2 border-b border-purple-500/20 flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="text-xs font-semibold text-purple-200">{getResourceName(cost.resource)}</div>
                                      <div className="text-[10px] text-purple-300/50">ID: {cost.resource}</div>
                                    </div>
                                    <div className="relative group/help">
                                      <HelpCircle className="w-3.5 h-3.5 text-purple-400/50 hover:text-purple-400 cursor-help transition-colors" />
                                      <div className="absolute right-0 top-6 hidden group-hover/help:block z-50 w-64 max-h-64 overflow-y-auto bg-black/95 border border-purple-500/30 rounded-lg p-2 shadow-xl">
                                        <div className="text-[10px] font-semibold text-purple-300 mb-1.5 sticky top-0 bg-black/95 pb-1">All Resources:</div>
                                        <div className="space-y-0.5">
                                          {getAllResources().map((res) => (
                                            <div key={res.id} className="text-[10px] text-white/70 hover:text-white hover:bg-purple-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors" onClick={() => {
                                              const newLevels = [...levels];
                                              const newCosts = [...costs];
                                              newCosts[costIdx] = { ...cost, resource: res.id };
                                              newLevels[levelIdx] = { ...item, cost_of_level: newCosts };
                                              updateConfig("structureLevelJson", JSON.stringify(newLevels, null, 2));
                                            }}>
                                              {res.id}: {res.name}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <label className="text-[10px] text-purple-300/60 mb-0.5 block">Resource</label>
                                      <select
                                        className="w-full rounded bg-black/40 px-2 py-1 text-xs text-purple-300 outline-none ring-1 ring-purple-500/20 focus:ring-purple-500/50 cursor-pointer"
                                        value={cost.resource || 0}
                                        onChange={(e) => {
                                          const newLevels = [...levels];
                                          const newCosts = [...costs];
                                          newCosts[costIdx] = { ...cost, resource: Number(e.target.value) };
                                          newLevels[levelIdx] = { ...item, cost_of_level: newCosts };
                                          updateConfig("structureLevelJson", JSON.stringify(newLevels, null, 2));
                                        }}
                                      >
                                        {getAllResources().map((res) => (
                                          <option key={res.id} value={res.id}>
                                            {res.id}: {res.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-[10px] text-purple-300/60 mb-0.5 block">Amount</label>
                                      <input
                                        type="number"
                                        className="w-full rounded bg-black/40 px-2 py-1 text-xs text-purple-300 outline-none ring-1 ring-purple-500/20 focus:ring-purple-500/50"
                                        value={cost.amount || 0}
                                        onChange={(e) => {
                                          const newLevels = [...levels];
                                          const newCosts = [...costs];
                                          newCosts[costIdx] = { ...cost, amount: Number(e.target.value) };
                                          newLevels[levelIdx] = { ...item, cost_of_level: newCosts };
                                          updateConfig("structureLevelJson", JSON.stringify(newLevels, null, 2));
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  } catch (e) {
                    return <div className="text-center text-red-400 text-sm p-4">Invalid data format</div>;
                  }
                })()}
              </div>
            </div>
          </section>

          {/* Starting Resources */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Starting Resources (Realm)</h2>
                  <p className="text-xs text-white/50 mt-0.5">Initial resources given to new realms</p>
                </div>
                <div className="px-3 py-1.5 bg-amber-500/20 rounded-lg border border-amber-500/30">
                  <span className="text-sm font-semibold text-amber-300">
                    {(() => {
                      try {
                        return JSON.parse(configState.startingResourcesJson).length + " Resources";
                      } catch {
                        return "Error";
                      }
                    })()}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                {(() => {
                  try {
                    const resources = JSON.parse(configState.startingResourcesJson);
                    return resources.map((item: any, idx: number) => (
                      <div key={idx} className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-lg p-3 hover:bg-amber-500/[0.15] transition-colors">
                        <div className="mb-2 pb-2 border-b border-amber-500/20 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-amber-200">{getResourceName(item.resource)}</div>
                            <div className="text-[10px] text-amber-300/50">ID: {item.resource}</div>
                          </div>
                          <div className="relative group/help">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-400/50 hover:text-amber-400 cursor-help transition-colors" />
                            <div className="absolute right-0 top-6 hidden group-hover/help:block z-50 w-64 max-h-64 overflow-y-auto bg-black/95 border border-amber-500/30 rounded-lg p-2 shadow-xl">
                              <div className="text-[10px] font-semibold text-amber-300 mb-1.5 sticky top-0 bg-black/95 pb-1">All Resources:</div>
                              <div className="space-y-0.5">
                                {getAllResources().map((res) => (
                                  <div key={res.id} className="text-[10px] text-white/70 hover:text-white hover:bg-amber-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors" onClick={() => {
                                    const newResources = [...resources];
                                    newResources[idx] = { ...item, resource: res.id };
                                    updateConfig("startingResourcesJson", JSON.stringify(newResources, null, 2));
                                  }}>
                                    {res.id}: {res.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-amber-300/70 mb-1 block">Resource</label>
                            <select
                              className="w-full rounded bg-black/30 px-2 py-1 text-sm text-amber-300 outline-none ring-1 ring-amber-500/20 focus:ring-amber-500/50 cursor-pointer"
                              value={item.resource || 0}
                              onChange={(e) => {
                                const newResources = [...resources];
                                newResources[idx] = { ...item, resource: Number(e.target.value) };
                                updateConfig("startingResourcesJson", JSON.stringify(newResources, null, 2));
                              }}
                            >
                              {getAllResources().map((res) => (
                                <option key={res.id} value={res.id}>
                                  {res.id}: {res.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-amber-300/70 mb-1 block">Amount</label>
                            <input
                              type="number"
                              className="w-full rounded bg-black/30 px-2 py-1 text-sm text-amber-300 outline-none ring-1 ring-amber-500/20 focus:ring-amber-500/50"
                              value={item.amount || 0}
                              onChange={(e) => {
                                const newResources = [...resources];
                                newResources[idx] = { ...item, amount: Number(e.target.value) };
                                updateConfig("startingResourcesJson", JSON.stringify(newResources, null, 2));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  } catch (e) {
                    return <div className="col-span-full text-center text-red-400 text-sm p-4">Invalid data format</div>;
                  }
                })()}
              </div>
            </div>
          </section>

          {/* Discoverable Village Resources */}
          <section className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30">
                  <Map className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">Discoverable Village Resources</h2>
                  <p className="text-xs text-white/50 mt-0.5">Resources found when discovering new villages</p>
                </div>
                <div className="px-3 py-1.5 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                  <span className="text-sm font-semibold text-cyan-300">
                    {(() => {
                      try {
                        return JSON.parse(configState.discoverableVillageJson).length + " Resources";
                      } catch {
                        return "Error";
                      }
                    })()}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                {(() => {
                  try {
                    const resources = JSON.parse(configState.discoverableVillageJson);
                    return resources.map((item: any, idx: number) => (
                      <div key={idx} className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-lg p-3 hover:bg-cyan-500/[0.15] transition-colors">
                        <div className="mb-2 pb-2 border-b border-cyan-500/20 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-cyan-200">{getResourceName(item.resource)}</div>
                            <div className="text-[10px] text-cyan-300/50">ID: {item.resource}</div>
                          </div>
                          <div className="relative group/help">
                            <HelpCircle className="w-3.5 h-3.5 text-cyan-400/50 hover:text-cyan-400 cursor-help transition-colors" />
                            <div className="absolute right-0 top-6 hidden group-hover/help:block z-50 w-64 max-h-64 overflow-y-auto bg-black/95 border border-cyan-500/30 rounded-lg p-2 shadow-xl">
                              <div className="text-[10px] font-semibold text-cyan-300 mb-1.5 sticky top-0 bg-black/95 pb-1">All Resources:</div>
                              <div className="space-y-0.5">
                                {getAllResources().map((res) => (
                                  <div
                                    key={res.id}
                                    className="text-[10px] text-white/70 hover:text-white hover:bg-cyan-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                    onClick={() => {
                                      const newResources = [...resources];
                                      newResources[idx] = { ...item, resource: res.id };
                                      updateConfig("discoverableVillageJson", JSON.stringify(newResources, null, 2));
                                    }}
                                  >
                                    {res.id}: {res.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-cyan-300/70 mb-1 block">Resource</label>
                            <select
                              className="w-full rounded bg-black/40 px-2 py-1 text-sm text-cyan-300 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50 cursor-pointer"
                              value={item.resource || 0}
                              onChange={(e) => {
                                const newResources = [...resources];
                                newResources[idx] = { ...item, resource: Number(e.target.value) };
                                updateConfig("discoverableVillageJson", JSON.stringify(newResources, null, 2));
                              }}
                            >
                              {getAllResources().map((res) => (
                                <option key={res.id} value={res.id}>
                                  {res.id}: {res.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-cyan-300/70 mb-1 block">Amount</label>
                            <input
                              type="number"
                              className="w-full rounded bg-black/30 px-2 py-1 text-sm text-cyan-300 outline-none ring-1 ring-cyan-500/20 focus:ring-cyan-500/50"
                              value={item.amount || 0}
                              onChange={(e) => {
                                const newResources = [...resources];
                                newResources[idx] = { ...item, amount: Number(e.target.value) };
                                updateConfig("discoverableVillageJson", JSON.stringify(newResources, null, 2));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  } catch (e) {
                    return <div className="col-span-full text-center text-red-400 text-sm p-4">Invalid data format</div>;
                  }
                })()}
              </div>
            </div>
          </section>

          {/* Info Banner */}
          <div className="mt-8 bg-gradient-to-r from-gold/10 via-orange/10 to-gold/10 border border-gold/30 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gold/20 rounded-xl">
                <Sparkles className="w-6 h-6 text-gold" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gold mb-2">Admin Control Center v2.0</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  You now have complete control over your Eternum configuration with a beautiful, intuitive interface.
                  All values are loaded from your config files and can be batched together for efficient deployment.
                  Use the search bar to quickly find settings, enable/disable sections as needed, and deploy with
                  confidence.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-xs text-white/60">
                    <span className="text-green-400">✓</span> Centralized State Management
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-xs text-white/60">
                    <span className="text-green-400">✓</span> Batch Configuration
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-xs text-white/60">
                    <span className="text-green-400">✓</span> Immediate Execution Support
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-xs text-white/60">
                    <span className="text-green-400">✓</span> Real-time Search & Filter
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-7xl mx-auto px-6 py-8 border-t border-white/10 mt-12 mb-8">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/40">
              <p>Eternum Admin Dashboard</p>
              <p className="text-xs mt-1">Powered by Starknet & Dojo</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-xs text-white/40">
                <p>Master Account</p>
                <p className="font-mono">{configState.worldAdminAddress.slice(0, 10)}...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
