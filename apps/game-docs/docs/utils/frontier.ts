import { nativePresetForId, nativePresetIdFor } from "../../../../config/source/native";
import { seasonDayUnitSeconds } from "../../../../config/source/common/season-clock";
import {
  RELICS_PER_LAYER,
  previewRuinGuardBounds,
} from "../../../../contracts/l3/world-native/schema/site-previews.gen";
import {
  nativeBaneConstants as bane,
  nativeFragmentConstants as fragments,
  nativeOathConstants as oaths,
  nativeRaceConstants as raceRules,
  nativeResearchConstants as research,
  nativeRuleConstants as rule,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { logisticsStamina } from "../../../../packages/core/src/utils/attribute-tiers";
import { aspectMeaning, orderMeaning, type IconMeaning } from "../../../game/src/ui/design-system/icon-meaning";
import {
  buildingMeaning,
  RELIC_KINDS,
  relicMeaning,
  type RelicKind,
} from "../../../game/src/ui/design-system/domain-icon-meaning";
import { ASPECT_PAGE_WORDS, RELIC_WORDS } from "../../../game/src/ui/design-system/kit/words";
import {
  ASPECT_REWARD,
  BuildingType,
  FRAGMENT_CENTS,
  FRAGMENTS_A_DAY,
  FRIEND_FRAGMENTS,
  FRIEND_GLORY,
  FRIENDS_BONUS_FRAGMENTS,
  FRIENDS_LIMIT,
  FRONTIER_BUILDING_TYPES,
  LAYER_NAMES,
  MIN_FRAGMENTS,
  STORE_PRODUCTS,
  TIER_WORDS,
  aspectLordsWorth,
  aspectName,
  aspects,
  baneQuests,
  beastOf,
  buildingName,
  dailyQuests,
  deepSites,
  getProducedResource,
  orders,
  ordersOfAspect,
  rankName,
  resourceName,
  worldBanes,
  type WorldBaneId,
} from "@bibliothecadao/types";
import { ETERNUM_CONFIG } from "./config";
import { CONTRACT } from "./contract-constants";
import { SEASON_ONE_CALENDAR } from "./season-calendar";

const frontierPreset = nativePresetForId(nativePresetIdFor("frontier"));
const config = ETERNUM_CONFIG("frontier");
const stamina = config.troop.stamina;
const limit = config.troop.limit;
const deepPreset = frontierPreset.deep!;
const racePreset = frontierPreset.race!;
const banesPreset = frontierPreset.banes!;
const questPreset = frontierPreset.dailyQuest!;

const n = (value: number) => value.toLocaleString("en-US");
const pct = (bps: number) => `${n(bps / 100)}%`;
const range = (lower: number, upper: number) => `${n(lower)}–${n(upper)}`;
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const perHour = (ratePerSecond: number) => n(Math.round(ratePerSecond * 3600));
const TIER_KEYS = ["common", "uncommon", "rare", "epic", "legendary"] as const;

const hoursOf = (units: number) => (units * seasonDayUnitSeconds(frontierPreset)) / 3600;

export const SHORT_DAY_UNITS = 2;
export const LONG_DAY_UNITS = 6;
const DAYS_PER_BAG = CONTRACT.daysPerBag;
const UNITS_PER_BAG = CONTRACT.unitsPerBag;

const tickMinutes = config.tick.armiesTickIntervalInSeconds / 60;

const KNIGHT = 26;
const WHEAT = 35;
const LABOR = 23;
const knightWheat = config.resources.productionBySimpleRecipe[KNIGHT]?.find(
  (input: { resource: number }) => input.resource === WHEAT,
);
if (!knightWheat) throw new Error("Frontier's Knight recipe takes no wheat");
const wheatPerTroop = knightWheat.amount / config.resources.productionBySimpleRecipeOutputs[KNIGHT];

const priceOf = (costs: readonly { resource: number; amount: number }[]) =>
  costs.map(({ resource, amount }) => `${n(amount)} ${resourceName(resource)}`).join(" + ");

const researchRow = (row: number) =>
  frontierPreset.research
    .filter((step) => step.row === row)
    .sort((a, b) => a.tier - b.tier)
    .map((step) => ({ essence: n(step.essenceCost), labor: n(step.laborCost) }));

const finishHeight = raceRules.STAGE_COUNT * racePreset.stageHeight;

const worldBaneMeta: Record<WorldBaneId, { icon: IconMeaning; effect: string }> = {
  [bane.BLOOD_MOON]: { icon: "moon", effect: `Guarded sites have ${n(banesPreset.beastPercent)}% strength.` },
  [bane.MIST_TIDE]: { icon: "waves", effect: `Stamina recovers at ${n(banesPreset.staminaPercent)}%.` },
  [bane.ASH_FALL]: { icon: "flame", effect: `Realm production runs at ${n(banesPreset.productionPercent)}%.` },
};

const oathEffects: Record<number, string> = {
  [oaths.POWER]: `Deals +${n(oaths.POWER_DAMAGE_PERCENT)}% damage.`,
  [oaths.GIANTS]: `Takes ${n(oaths.GIANTS_REDUCTION_PERCENT)}% less damage.`,
  [oaths.SKILL]: `Deals +${n(oaths.SKILL_DAMAGE_PERCENT)}% damage when stamina after attack is below ${n(oaths.SKILL_BELOW_STAMINA)}.`,
  [oaths.TITANS]: `Gains +${n(oaths.TITANS_STAMINA)} stamina immediately and +${n(oaths.TITANS_STAMINA)} max stamina.`,
  [oaths.PERFECTION]: `Site rewards pay ${n(oaths.PERFECTION_PAY_PERCENT)}% when you lose under ${n(oaths.PERFECTION_LOSS_PERCENT)}% troops.`,
  [oaths.BRILLIANCE]: `Reveal payouts pay ${n(oaths.BRILLIANCE_PAY_PERCENT)}%.`,
  [oaths.PROTECTION]: `Takes ${n(oaths.PROTECTION_REDUCTION_PERCENT)}% less damage while guarding a site.`,
  [oaths.ENLIGHTENMENT]: `Recovers stamina ${Math.round((oaths.ENLIGHTENMENT_REGEN_BPS - 10000) / 100)}% faster.`,
  [oaths.RAGE]: `Site and guard rewards pay ${n(oaths.RAGE_PAY_PERCENT)}%.`,
  [oaths.FURY]: `Refunds ${n(oaths.FURY_REFUND_PERCENT)}% of attack stamina on a won fight.`,
  [oaths.VITRIOL]: `Cuts Deep troop drain from ${n(deepPreset.lossPerTick)} to ${n(oaths.VITRIOL_LOSS_PER_TICK)} per tick.`,
  [oaths.ANGER]: `Cuts attack stamina cost from ${n(stamina.staminaAttackReq)} to ${n(oaths.ANGER_ATTACK_STAMINA)}.`,
  [oaths.FOX]: `Cuts tile reveal stamina cost by ${n(oaths.FOX_REVEAL_DISCOUNT_PERCENT)}%.`,
  [oaths.TWINS]: `Nearby allied army adds +${n(oaths.TWINS_DAMAGE_PERCENT)}% companion damage.`,
  [oaths.REFLECTION]: `Wells refill ${n(oaths.REFLECTION_WELL_PERCENT)}% of max stamina instead of ${n(rule.WELL_REFILL_PERCENT)}%.`,
  [oaths.DETECTION]: `Guarantees a discovery after ${n(oaths.DETECTION_EMPTY_REVEAL_LIMIT)} empty reveals instead of ${n(frontierPreset.discovery.emptyRevealLimit)}.`,
};

const aspectOrders = orders.filter((order) => order.aspect !== null);
const oathRows = aspectOrders.map((order) => {
  const effect = oathEffects[order.orderId];
  if (!effect) throw new Error(`Missing Oath effect for Order ${order.orderId}`);
  return {
    name: order.orderName,
    icon: orderMeaning(order.orderId),
    aspect: aspectName(order.aspect!),
    effect,
  };
});

const buildingRate = (id: BuildingType): string | null => {
  if (id === research.WORKSHOP) return perHour(frontierPreset.board.workshopRate);
  const produced = getProducedResource(id);
  if (produced === undefined) return null;
  const rate = config.resources.productionByComplexRecipeOutputs[produced];
  return rate > 0 ? perHour(rate) : null;
};

const commandEnabled = (name: keyof typeof nativeCommandBits) =>
  (frontierPreset.commandMask & BigInt(nativeCommandBits[name])) !== 0n;

const sealEnabled = commandEnabled("BuySeal");
const staminaEnabled = commandEnabled("BuyStamina");
const rerollEnabled = commandEnabled("RerollOath");
const anySpendEnabled = sealEnabled || staminaEnabled || rerollEnabled;
const barFragments = n(Math.ceil(stamina.staminaKnightMax / fragments.STAMINA_PER_FRAGMENT));

const buildingMeta: Partial<Record<BuildingType, { makes: string; level: number; order: number }>> = {
  [research.FARM]: { makes: "Wheat", level: 0, order: 0 },
  [research.BARRACKS]: { makes: "Knights", level: 0, order: 1 },
  [research.RANGE]: { makes: "Crossbowmen", level: research.RANGE_LEVEL, order: 2 },
  [research.SCOUTS_LODGE]: { makes: "Scouts", level: research.SCOUTS_LODGE_LEVEL, order: 3 },
  [research.WORKSHOP]: { makes: "Labor", level: 0, order: 4 },
  [research.STOREROOM]: { makes: "Wheat and labor storage", level: research.STOREROOM_LEVEL, order: 5 },
  [research.CONSCRIPTION_CAMP]: { makes: "Faster troop training", level: research.CONSCRIPTION_CAMP_LEVEL, order: 6 },
  [research.RATIONS_DEPOT]: { makes: "Lower wheat cost to deploy", level: research.RATIONS_DEPOT_LEVEL, order: 7 },
  [research.SUPPLY_YARD]: { makes: "Logistics training", level: research.SUPPLY_YARD_LEVEL, order: 8 },
};

const frontierBuildings = [...FRONTIER_BUILDING_TYPES]
  .map((id) => {
    const meta = buildingMeta[id];
    if (!meta) throw new Error(`Missing Frontier building row for ${id}`);
    const rate = buildingRate(id);
    return {
      order: meta.order,
      name: buildingName(id, true),
      makes: rate ? `${meta.makes} (${rate}/h)` : meta.makes,
      icon: buildingMeaning(id, true),
      opens: rankName(meta.level),
      price: priceOf(config.buildings.simpleBuildingCost[id]),
    };
  })
  .sort((a, b) => a.order - b.order);

const relicEffects: Record<RelicKind, { step: string; range: string }> = {
  Blade: {
    step: `+${pct(rule.RELIC_BLADE_BPS)} damage dealt`,
    range: `+${pct(rule.RELIC_BLADE_BPS)} → +${pct(rule.RELIC_BLADE_BPS * rule.ATTRIBUTE_CAP)}`,
  },
  Ward: {
    step: `−${pct(rule.RELIC_WARD_BPS)} damage taken`,
    range: `−${pct(rule.RELIC_WARD_BPS)} → −${pct(rule.RELIC_WARD_BPS * rule.ATTRIBUTE_CAP)}`,
  },
  Plunder: {
    step: `+${pct(rule.RELIC_PLUNDER_BPS)} cleared site rewards`,
    range: `+${pct(rule.RELIC_PLUNDER_BPS)} → +${pct(rule.RELIC_PLUNDER_BPS * rule.ATTRIBUTE_CAP)}`,
  },
  StaminaRegen: {
    step: `+${n(rule.STAMINA_REGEN_RELIC_STEP_PERCENT)}% stamina recovery`,
    range: `+${n(rule.STAMINA_REGEN_RELIC_STEP_PERCENT)}% → +${n(rule.STAMINA_REGEN_RELIC_STEP_PERCENT * rule.ATTRIBUTE_CAP)}%`,
  },
};

export const FRONTIER = {
  calendar: SEASON_ONE_CALENDAR,
  day: {
    shortestHours: hoursOf(SHORT_DAY_UNITS),
    longestHours: hoursOf(LONG_DAY_UNITS),
    daysPerBag: DAYS_PER_BAG,
    bagHours: hoursOf(UNITS_PER_BAG),
    seasonDays: n(racePreset.seasonDays),
  },
  realm: {
    troops: n(config.startingResources.find((r: { resource: number }) => r.resource === KNIGHT).amount),
    wheat: n(config.startingResources.find((r: { resource: number }) => r.resource === WHEAT).amount),
    labor: n(config.startingResources.find((r: { resource: number }) => r.resource === LABOR).amount),
    armies: [limit.settlementArmies, limit.cityArmies, limit.kingdomArmies, limit.empireArmies].map(n),
    deployCaps: [
      limit.settlementDeploymentCap,
      limit.cityDeploymentCap,
      limit.kingdomDeploymentCap,
      limit.empireDeploymentCap,
    ].map(n),
    castleLabor: [1, 2, 3].map((level) => n(config.realmUpgradeCosts[level][0].amount)),
    demolitionRefund: pct(frontierPreset.board.demolitionRefundBps),
    deployWheat: n(config.resources.productionBySimpleRecipe[KNIGHT][0].amount),
    storage: frontierPreset.board.resourceStoreCaps.map(n),
    laborStorage: frontierPreset.board.laborStoreCaps!.map(n),
    castleLaborStep: n(CONTRACT.castleLaborStep),
    castleLaborRates: Array.from({ length: config.realmMaxLevel }, (_, level) =>
      perHour(config.resources.productionByComplexRecipeOutputs[LABOR] * CONTRACT.castleLaborStep ** level),
    ),
    rationStep: String(frontierPreset.board.rationStep),
  },
  stamina: {
    max: n(stamina.staminaKnightMax),
    perTick: n(stamina.staminaGainPerTick),
    tickMinutes: n(tickMinutes),
    fullHours: n(((stamina.staminaKnightMax / stamina.staminaGainPerTick) * tickMinutes) / 60),
    reveal: n(stamina.staminaExploreStaminaCost),
    scoutReveal: n(rule.SCOUT_EXPLORE_STAMINA),
    step: n(stamina.staminaTravelStaminaCost),
    attack: n(stamina.staminaAttackReq),
    wheatPerTroop: n(stamina.staminaExploreWheatCost),
    well: `${n(rule.WELL_REFILL_PERCENT)}% of its maximum`,
    logisticsStep: `${n(rule.LOGISTICS_STEP_PERCENT)}%`,
    logisticsMax: n(logisticsStamina(stamina.staminaKnightMax, rule.ATTRIBUTE_CAP)),
    perFragment: n(fragments.STAMINA_PER_FRAGMENT),
  },
  discovery: {
    beasts: pct(frontierPreset.discovery.beastsBps),
    bandsPerHerd: n(rule.BEAST_BAND_SHARE / rule.BEAST_HERD_SHARE),
    camp: pct(frontierPreset.discovery.campBps),
    rift: pct(frontierPreset.discovery.riftBps),
    ruin: pct(frontierPreset.discovery.ruinBps),
    shrine: pct(frontierPreset.discovery.shrineBps),
    well: pct(frontierPreset.discovery.wellBps),
    emptyRevealLimit: n(frontierPreset.discovery.emptyRevealLimit),
    spireRevealLimit: n(rule.SPIRE_REVEAL_LIMIT),
    revealTroopCap: n(limit.exploreRewardStrengthCap),
  },
  depths: frontierPreset.depths.map((depth, index) => ({
    name: LAYER_NAMES[index],
    revealPercent: `${depth.revealPercent}%`,
    campGuard: `${beastOf("camp", index).name} ${range(depth.siteGuardLower, depth.siteGuardUpper)}`,
    riftGuard: `${beastOf("rift", index).name} ${range(depth.riftGuardLower, depth.riftGuardUpper)}`,
    beastWeak: `${beastOf("herd", index).name} ${range(depth.beastWeakLower, depth.beastWeakUpper)}`,
    beastStrong: `${beastOf("band", index).name} ${range(depth.beastStrongLower, depth.beastStrongUpper)}`,
    ruinGuard: beastOf("ruin", index).name,
  })),
  ruinGuards: LAYER_NAMES.slice(0, 3).flatMap((layer, depth) =>
    TIER_WORDS.slice(depth, depth + RELICS_PER_LAYER).map((name, place) => ({
      layer,
      name,
      count: range(...previewRuinGuardBounds(depth + place + 1, depth)),
    })),
  ),
  caches: {
    surface: `${fragments.SURFACE_CACHE_PERCENT}%`,
    veil: `${fragments.VEIL_CACHE_PERCENT}%`,
    hollow: `${fragments.HOLLOW_CACHE_PERCENT}%`,
    troopsPerFragment: n(fragments.CACHE_TROOPS_PER_FRAGMENT),
  },
  buildingsCount: n(FRONTIER_BUILDING_TYPES.length),
  buildings: frontierBuildings,
  buildingIcons: {
    farm: buildingMeaning(research.FARM, true),
    workshop: buildingMeaning(research.WORKSHOP, true),
    storeroom: buildingMeaning(research.STOREROOM, true),
    conscriptionCamp: buildingMeaning(research.CONSCRIPTION_CAMP, true),
    rationsDepot: buildingMeaning(research.RATIONS_DEPOT, true),
    supplyYard: buildingMeaning(research.SUPPLY_YARD, true),
  },
  names: {
    farm: buildingName(research.FARM, true),
    barracks: buildingName(research.BARRACKS, true),
    range: buildingName(research.RANGE, true),
    scoutsLodge: buildingName(research.SCOUTS_LODGE, true),
    workshop: buildingName(research.WORKSHOP, true),
    storeroom: buildingName(research.STOREROOM, true),
    conscriptionCamp: buildingName(research.CONSCRIPTION_CAMP, true),
    rationsDepot: buildingName(research.RATIONS_DEPOT, true),
    supplyYard: buildingName(research.SUPPLY_YARD, true),
    deep: LAYER_NAMES[3],
  },
  storeroom: {
    opens: rankName(research.STOREROOM_LEVEL),
    storageStep: pct(frontierPreset.board.storageStepBps),
  },
  conscriptionOpens: rankName(research.CONSCRIPTION_CAMP_LEVEL),
  rationsOpens: rankName(research.RATIONS_DEPOT_LEVEL),
  supplyYardOpens: rankName(research.SUPPLY_YARD_LEVEL),
  research: {
    farm: researchRow(research.ROW_FARM),
    workshop: researchRow(research.ROW_WORKSHOP),
    conscription: researchRow(research.ROW_CONSCRIPTION),
    rations: researchRow(research.ROW_RATIONS),
    training: researchRow(research.ROW_SUPPLY_YARD),
    oathSlotsSummary: researchRow(research.ROW_KNIGHT_OATHS)
      .map(
        ({ essence, labor }, index) =>
          `Slot ${n(research.OATH_SLOTS_BASE + index + 1)}: ${essence} Essence, ${labor} labor`,
      )
      .join("; "),
    lore: researchRow(research.ROW_LORE),
    outputStep: pct(frontierPreset.board.outputStepBps),
    troopWheat: n(wheatPerTroop),
  },
  attributes: {
    lightDamageReduction: `${100 - rule.FRONTIER_LIGHT_DAMAGE_PERCENT}%`,
    knightGuardReduction: `${100 - rule.FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT}%`,
  },
  quest: {
    count: n(dailyQuests.length),
    labor: n(questPreset.labor),
    essence: n(questPreset.essence),
    bonusPercent: `${n(questPreset.bonusPercent)}%`,
    wonderFragments: n(fragments.WONDER_QUEST_FRAGMENTS),
    levelStep: n(CONTRACT.questLevelStep),
    levelScale: Array.from(
      { length: config.realmMaxLevel },
      (_, level) => `${n(CONTRACT.questLevelStep ** level)}x at ${rankName(level)}`,
    ).join(", "),
    list: dailyQuests.map((quest, index) => ({
      name: quest.name,
      objective: quest.objective,
      baseCount: n(questPreset.baseCounts[index]!),
    })),
  },
  banes: {
    chanceStep: `${n(banesPreset.chanceStep)}%`,
    quorum: `${n(banesPreset.quorumPercent)}%`,
    world: worldBanes.map((entry) => {
      const quest = baneQuests.find((q) => q.id === entry.quest);
      if (!quest) throw new Error(`Missing bane quest ${entry.quest}`);
      const meta = worldBaneMeta[entry.id];
      return {
        name: entry.name,
        icon: meta.icon,
        effect: meta.effect,
        questName: quest.name,
        questObjective: quest.objective,
      };
    }),
    questNames: baneQuests.map((quest) => quest.name).join(", "),
  },
  deep: {
    mapSize: n(rule.DEEP_MAP_SIZE),
    gateDistance: n(deepPreset.gateDistance),
    guardSlots: n(rule.DEEP_GUARD_SLOTS),
    sitesPerRing: n(rule.DEEP_RING_SITES),
    lossPerTick: n(deepPreset.lossPerTick),
    corePerTick: n(deepPreset.corePerTick),
    minePerTick: n(deepPreset.minePerTick),
    payAlone: n(deepPreset.buildingPay.alone),
    payPair: n(deepPreset.buildingPay.pair),
    payCrowd: n(deepPreset.buildingPay.crowd),
    altarThreshold: n(deepPreset.altarThreshold),
    ringsCount: n(deepPreset.rings.length),
    sitesCount: n(deepSites.length),
    rings: deepPreset.rings.map((ring, index) => ({
      number: index + 1,
      radius: n(ring.radius),
      realms: n(ring.realms),
    })),
    sites: deepSites.map((site) => {
      const beast = deepPreset.beasts[site.key];
      return {
        name: site.name,
        troops: n(beast.count),
        weapon: beast.bow ? "Bow" : "Blade",
      };
    }),
  },
  aspectsCount: n(aspects.length),
  aspects: aspects.map((aspect) => ({
    name: aspect.name,
    icon: aspectMeaning(aspect.id),
    orders: ordersOfAspect(aspect.id).map((order) => ({
      name: order.orderName,
      icon: orderMeaning(order.orderId),
    })),
  })),
  race: {
    stages: n(raceRules.STAGE_COUNT),
    stageHeight: n(racePreset.stageHeight),
    finishHeight: n(finishHeight),
    lordsPerHeight: n(ASPECT_REWARD.lordsPerHeight),
    finishBonus: n(ASPECT_REWARD.finishBonus),
    maxFinishLords: n(aspectLordsWorth(finishHeight, true)),
    gloryToShare: n(ASPECT_REWARD.gloryToShare),
    triumphRows: [
      {
        stage: `Stage ${raceRules.CLEAR_MIST_STAGE} (${n(racePreset.stageHeight * raceRules.CLEAR_MIST_STAGE)} height)`,
        name: ASPECT_PAGE_WORDS.triumph[raceRules.CLEAR_MIST_STAGE],
        effect: `Sites are found at ${n(racePreset.clearMistPercent)}% of the usual odds.`,
      },
      {
        stage: `Stage ${raceRules.SECOND_WIND_STAGE} (${n(racePreset.stageHeight * raceRules.SECOND_WIND_STAGE)} height)`,
        name: ASPECT_PAGE_WORDS.triumph[raceRules.SECOND_WIND_STAGE],
        effect: `Stamina recovers at ${n(racePreset.secondWindPercent)}%.`,
      },
      {
        stage: `Stage ${raceRules.PALE_MOON_STAGE} (${n(racePreset.stageHeight * raceRules.PALE_MOON_STAGE)} height)`,
        name: ASPECT_PAGE_WORDS.triumph[raceRules.PALE_MOON_STAGE],
        effect: `Guarded sites have ${n(racePreset.paleMoonPercent)}% strength.`,
      },
      {
        stage: `Stage ${raceRules.SPOILS_STAGE} (${n(racePreset.stageHeight * raceRules.SPOILS_STAGE)} height)`,
        name: ASPECT_PAGE_WORDS.triumph[raceRules.SPOILS_STAGE],
        effect: `Site rewards pay ${n(racePreset.spoilsPercent)}%.`,
      },
    ],
  },
  oaths: {
    count: n(oathRows.length),
    baseSlots: n(research.OATH_SLOTS_BASE),
    extraSlots: n(research.OATH_SLOTS_STEPS),
    maxSlots: n(research.OATH_SLOTS_BASE + research.OATH_SLOTS_STEPS),
    passStamina: n(oaths.PASS_STAMINA),
    rerollFragments: n(fragments.OATH_REROLL_FRAGMENTS),
    rerollNote: rerollEnabled
      ? `Spend ${n(fragments.OATH_REROLL_FRAGMENTS)} Fragments to replace one of the 3 drawn cards once per draw (disabled in the Deep).`
      : `Turned off while Fragment spending is disabled. When enabled (above the Deep), spending ${n(fragments.OATH_REROLL_FRAGMENTS)} Fragments replaces one of the 3 drawn cards once per draw.`,
    vitriolLoss: n(oaths.VITRIOL_LOSS_PER_TICK),
    reflectionWell: `${n(oaths.REFLECTION_WELL_PERCENT)}%`,
    detectionLimit: n(oaths.DETECTION_EMPTY_REVEAL_LIMIT),
    rows: oathRows,
  },
  relics: {
    count: n(RELIC_KINDS.length),
    tiersCount: n(TIER_WORDS.length),
    firstTier: TIER_WORDS[0],
    lastTier: TIER_WORDS[TIER_WORDS.length - 1],
    slots: n(CONTRACT.armyRelicSlots),
    minutesPerTier: n(CONTRACT.relicSecondsPerRank / 60),
    maxMinutes: n((CONTRACT.relicSecondsPerRank * rule.ATTRIBUTE_CAP) / 60),
    rows: RELIC_KINDS.map((kind) => ({
      name: RELIC_WORDS.kinds[kind],
      icon: relicMeaning(kind),
      ...relicEffects[kind],
    })),
    layerOdds: frontierPreset.depths.map((depth, index) => ({
      layer: LAYER_NAMES[index],
      odds: TIER_KEYS.map((tier, tierIndex) => ({ name: TIER_WORDS[tierIndex], bps: depth.chest[tier] }))
        .filter(({ bps }) => bps > 0)
        .map(({ name, bps }) => `${name} (${pct(bps)})`)
        .join(", "),
    })),
  },
  shop: {
    lordsNote: anySpendEnabled
      ? "The Shop accepts LORDS (or swaps ETH, STRK, or USDC into LORDS through AVNU) to buy Fragments."
      : "The Shop is built to accept LORDS (or swap ETH, STRK, or USDC into LORDS through AVNU) for Fragments, and Fragment spending is currently turned off in the active Season 1 preset.",
    statusNote: anySpendEnabled
      ? "Fragment spending is enabled in the active preset."
      : `Fragment spending (the Ancient Seal, stamina refills, and Oath rerolls) is currently turned off in the active Season 1 preset, including during the Final Testnet (${SEASON_ONE_CALENDAR.testnetDates} UTC).`,
    sealRule: sealEnabled
      ? `Lasts the whole season. Gives ${n(questPreset.bonusPercent)}% daily quest labor and the Season 1 Realm skin. You can also redeem an Ancient Seal code.`
      : `Turned off while Fragment spending is disabled. When enabled, lasts the whole season, gives ${n(questPreset.bonusPercent)}% daily quest labor and the Season 1 Realm skin, or can be redeemed with an Ancient Seal code.`,
    staminaRule: staminaEnabled
      ? `Works on the Surface, Veil, and Hollow (${barFragments} Fragments for a full ${n(stamina.staminaKnightMax)} bar at ${n(fragments.STAMINA_PER_FRAGMENT)} stamina per Fragment). Disabled inside the Deep.`
      : `Turned off while Fragment spending is disabled. When enabled (above the Deep), refills ${n(fragments.STAMINA_PER_FRAGMENT)} stamina per Fragment (${barFragments} Fragments for a full ${n(stamina.staminaKnightMax)} bar).`,
    fragmentCents: n(FRAGMENT_CENTS),
    minFragments: n(MIN_FRAGMENTS),
    dailyCap: n(FRAGMENTS_A_DAY),
    sealFragments: n(fragments.SEAL_FRAGMENTS),
    sealDollars: dollars(fragments.SEAL_FRAGMENTS * FRAGMENT_CENTS),
    packs: Object.values(STORE_PRODUCTS).map((pack) => ({
      fragments: n(pack.fragments),
      price: dollars(pack.cents),
    })),
    friendGlory: n(FRIEND_GLORY),
    friendFragments: n(FRIEND_FRAGMENTS),
    friendsLimit: n(FRIENDS_LIMIT),
    friendsBonus: n(FRIENDS_BONUS_FRAGMENTS),
  },
};
