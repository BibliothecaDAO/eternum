import { ResourcesIds } from "../../../packages/types/src/constants";
import type { ConfigPatch } from "../common/merge-config";

const TROOP_DAMAGE_RAID_PERCENT_NUM = 1_000; //10%

const TROOP_BASE_DAMAGE = 1844674407370955161600n; // 100
const TROOP_T2_DAMAGE_MULTIPLIER = 55340232221128654848n; // 3
const TROOP_T3_DAMAGE_MULTIPLIER = 166020696663385964544n; // 9
const TROOP_DAMAGE_BIOME_BONUS_NUM = 3_000; // 3_000/10_000 = 30%
const TROOP_DAMAGE_SCALING_FACTOR = 36893488147419103232n; // 2

// Stamina config
const TROOP_STAMINA_INITIAL = 20;
const TROOP_STAMINA_GAIN_PER_TICK = 20;
const TROOP_STAMINA_BIOME_BONUS_VALUE = 10; // give 1 tick worth of stamina

const TROOP_STAMINA_MAX = {
  [ResourcesIds.Knight]: 120,
  [ResourcesIds.Crossbowman]: 120,
  [ResourcesIds.Paladin]: 120,
};

// Combat stamina requirements
const TROOP_STAMINA_ATTACK_REQ = 50;
const TROOP_STAMINA_DEFENSE_REQ = 40;
// Troop travel
const TROOP_TRAVEL_WHEAT_COST = 0.03;
const TROOP_TRAVEL_FISH_COST = 0.03;
const TROOP_TRAVEL_STAMINA_COST = 20;

// Troop exploration
const TROOP_EXPLORE_WHEAT_COST = 0.03;
const TROOP_EXPLORE_FISH_COST = 0.03;
const TROOP_EXPLORE_STAMINA_COST = 30;

// Troop limit config
const TROOP_GUARD_RESURRECTION_DELAY = 60 * 10; // 10 minutes
const TROOP_MERCENARIES_TROOP_LOWER_BOUND = 800;
const TROOP_MERCENARIES_TROOP_UPPER_BOUND = 1_500; // must not be > 1500 to not exceed t1 camp and rift limits

// Army Strength: Army_Strength = Troop_Amount * Tier_Strength
// Max_Army_Size = (Deployment_Cap / Tier_Strength) * Tier_Modifier
const TROOP_TIER_STRENGTH = { T1: 1, T2: 3, T3: 9 };
const TROOP_TIER_MODIFIER = { T1: 50, T2: 100, T3: 150 }; // /100 (50 = 0.5, 100 = 1.0, 150 = 1.5)

// Deployment caps per structure level (without precision)
const TROOP_SETTLEMENT_DEPLOYMENT_CAP = 3_000;
const TROOP_CITY_DEPLOYMENT_CAP = 15_000;
const TROOP_KINGDOM_DEPLOYMENT_CAP = 45_000;
const TROOP_EMPIRE_DEPLOYMENT_CAP = 90_000;

export const eternumTroopConfig: ConfigPatch = {
  troop: {
    damage: {
      t1DamageValue: TROOP_BASE_DAMAGE,
      t2DamageMultiplier: TROOP_T2_DAMAGE_MULTIPLIER,
      t3DamageMultiplier: TROOP_T3_DAMAGE_MULTIPLIER,
      damageRaidPercentNum: TROOP_DAMAGE_RAID_PERCENT_NUM,
      damageBiomeBonusNum: TROOP_DAMAGE_BIOME_BONUS_NUM,
      damageScalingFactor: TROOP_DAMAGE_SCALING_FACTOR,
    },
    stamina: {
      damageStaminaRefund: true,
      captureStaminaRefund: 0,
      staminaGainPerTick: TROOP_STAMINA_GAIN_PER_TICK,
      staminaInitial: TROOP_STAMINA_INITIAL,
      staminaBonusValue: TROOP_STAMINA_BIOME_BONUS_VALUE,
      staminaKnightMax: TROOP_STAMINA_MAX[ResourcesIds.Knight],
      staminaPaladinMax: TROOP_STAMINA_MAX[ResourcesIds.Paladin],
      staminaCrossbowmanMax: TROOP_STAMINA_MAX[ResourcesIds.Crossbowman],
      staminaAttackReq: TROOP_STAMINA_ATTACK_REQ,
      staminaDefenseReq: TROOP_STAMINA_DEFENSE_REQ,
      staminaExploreWheatCost: TROOP_EXPLORE_WHEAT_COST,
      staminaExploreFishCost: TROOP_EXPLORE_FISH_COST,
      staminaExploreStaminaCost: TROOP_EXPLORE_STAMINA_COST,
      staminaTravelWheatCost: TROOP_TRAVEL_WHEAT_COST,
      staminaTravelFishCost: TROOP_TRAVEL_FISH_COST,
      staminaTravelStaminaCost: TROOP_TRAVEL_STAMINA_COST,
    },
    limit: {
      guardResurrectionDelay: TROOP_GUARD_RESURRECTION_DELAY,
      settlementArmies: 1,
      cityArmies: 3,
      kingdomArmies: 5,
      empireArmies: 8,
      settlementGuardSlots: 1,
      cityGuardSlots: 2,
      kingdomGuardSlots: 3,
      empireGuardSlots: 4,
      startingGuard: 1500,
      campArmies: 1,

      mercenariesTroopLowerBound: TROOP_MERCENARIES_TROOP_LOWER_BOUND,
      mercenariesTroopUpperBound: TROOP_MERCENARIES_TROOP_UPPER_BOUND,
      settlementDeploymentCap: TROOP_SETTLEMENT_DEPLOYMENT_CAP,
      cityDeploymentCap: TROOP_CITY_DEPLOYMENT_CAP,
      kingdomDeploymentCap: TROOP_KINGDOM_DEPLOYMENT_CAP,
      empireDeploymentCap: TROOP_EMPIRE_DEPLOYMENT_CAP,
      t1TierStrength: TROOP_TIER_STRENGTH.T1,
      t2TierStrength: TROOP_TIER_STRENGTH.T2,
      t3TierStrength: TROOP_TIER_STRENGTH.T3,
      t1TierModifier: TROOP_TIER_MODIFIER.T1,
      t2TierModifier: TROOP_TIER_MODIFIER.T2,
      t3TierModifier: TROOP_TIER_MODIFIER.T3,
    },
  },
};
