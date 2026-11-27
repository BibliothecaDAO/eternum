import { describe, expect, test } from "bun:test";
import release from "../../../../contracts/l3/world-native/schema/release-definition.json";
import {
  nativeFragmentConstants as fragments,
  nativeOathConstants as oaths,
  nativeRaceConstants as race,
  nativeResearchConstants as research,
  nativeRuleConstants as rules,
  nativeStructureConstants as structures,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
import { RESOURCE_PRECISION, ResourcesIds } from "../../../../packages/types/src/constants";
import { seasonOneDesign } from "../../../source/frontier/season-one-design";
import { FRONTIER_S1_PRESET_ID } from "../../../source/common/native-preset-modes";
import { gameClockScale } from "../../../source/common/season-clock";
import { nativePresetForId } from "../../../source/native";

type Amount = { resource_type: number; amount: string };
type Design = typeof seasonOneDesign;

const definition = release.definition;
const board = definition.structures.board.Some;
const deep = definition.economy.deep.Some;
const discovery = definition.economy.discovery.Some;
const quests = definition.economy.quests.Some;
const banes = definition.economy.banes.Some;
const seasonRace = definition.economy.race.Some;
const stamina = definition.rules.troop_stamina_config;
const limits = definition.rules.troop_limit_config;
const damage = definition.rules.troop_damage_config;
const layers = definition.settlement.depths;

const FIXED_ONE = 2n ** 64n;
const SECONDS_PER_HOUR = 3600;
const STAMINA_TICKS_PER_HOUR = SECONDS_PER_HOUR / definition.rules.tick_config.armies_tick_in_seconds;

const whole = (precise: string | number) => Number(precise) / RESOURCE_PRECISION;
const fixed = (value: string | number) => Number(BigInt(value) / FIXED_ONE);
const percent = (bps: number) => bps / 100;
const hundredths = (value: number) => Math.round(value * 100) / 100;
const perHour = (perSecond: string | number) => hundredths(whole(perSecond) * SECONDS_PER_HOUR);
const amountOf = (amounts: Amount[], resource: ResourcesIds) =>
  whole(amounts.find(({ resource_type }) => resource_type === resource)?.amount ?? 0);
const priceOf = (amounts: Amount[]) => ({
  essence: amountOf(amounts, ResourcesIds.Essence),
  labor: amountOf(amounts, ResourcesIds.Labor),
});
const named = <Name extends string>(names: Record<Name, number>, id: number) =>
  (Object.keys(names) as Name[]).find((name) => names[name] === id) ?? `unnamed ${id}`;
const buildingNames = {
  farm: research.FARM,
  workshop: research.WORKSHOP,
  storeroom: research.STOREROOM,
  barracks: research.BARRACKS,
  range: research.RANGE,
  scoutsLodge: research.SCOUTS_LODGE,
  conscriptionCamp: research.CONSCRIPTION_CAMP,
  rationsDepot: research.RATIONS_DEPOT,
  supplyYard: research.SUPPLY_YARD,
};
const researchNames = {
  fields: research.ROW_FARM,
  tools: research.ROW_WORKSHOP,
  conscription: research.ROW_CONSCRIPTION,
  rations: research.ROW_RATIONS,
  logistics: research.ROW_SUPPLY_YARD,
  knightOaths: research.ROW_KNIGHT_OATHS,
  scoutOaths: research.ROW_SCOUT_OATHS,
  crossbowOaths: research.ROW_CROSSBOW_OATHS,
  lore: research.ROW_LORE,
};
const buildingPrices = () =>
  Object.fromEntries(
    definition.structures.buildings
      .filter(({ rule }) => rule.simple_cost.length > 0)
      .map(({ category, rule }) => [named(buildingNames, category), priceOf(rule.simple_cost)]),
  ) as Record<keyof typeof buildingNames, ReturnType<typeof priceOf>>;
const researchPrices = () => {
  const rows = {} as Record<keyof typeof researchNames, { essence: number; labor: number }[]>;
  for (const step of definition.structures.research.toSorted((a, b) => a.tier - b.tier)) {
    const name = named(researchNames, step.row) as keyof typeof researchNames;
    rows[name] = [...(rows[name] ?? []), { essence: whole(step.price.essence), labor: whole(step.price.labor) }];
  }
  return rows;
};
const hasPopulation = () =>
  definition.rules.building_config.base_population > 0 ||
  definition.structures.buildings.some(({ rule }) => rule.population_cost > 0 || rule.capacity_grant > 0);
const realmRatePerHour = (resource: ResourcesIds) =>
  perHour(definition.resources.resources.find(({ resource_type }) => resource_type === resource)!.realm_rate);
const centre = (lower: number, upper: number) => (lower + upper) / 2;
const beastShare = (share: number) =>
  (percent(discovery.beasts_bps) * share) / (rules.BEAST_HERD_SHARE + rules.BEAST_BAND_SHARE);

function generatedSeasonOne(): Design {
  return {
    clock: {
      armyTickSeconds: definition.rules.tick_config.armies_tick_in_seconds,
      staminaPerTick: stamina.stamina_gain_per_tick,
      staminaBar: stamina.stamina_initial,
      dayUnitSeconds: definition.rules.day_unit_seconds,
      seasonDays: Number(seasonRace.season_days),
      baneQuietDays: nativePresetForId(FRONTIER_S1_PRESET_ID).banes!.quietDays,
      baneChanceStepPercent: banes.chance_step,
      speed: gameClockScale(nativePresetForId(FRONTIER_S1_PRESET_ID)),
    },
    realm: {
      upgradeLabor: definition.structures.upgrades.map(({ costs }) => amountOf(costs, ResourcesIds.Labor)),
      laborStore: [...structures.LABOR_STORES],
      castleLaborPerHour: realmRatePerHour(ResourcesIds.Labor),
      storeroomStorePercent: percent(board.storage_step_bps),
      population: hasPopulation(),
    },
    start: {
      knights: amountOf(definition.settlement.realms.resources, ResourcesIds.Knight),
      wheat: amountOf(definition.settlement.realms.resources, ResourcesIds.Wheat),
      labor: amountOf(definition.settlement.realms.resources, ResourcesIds.Labor),
    },
    buildings: {
      ...buildingPrices(),
      copySurchargePercent: percent(definition.rules.building_config.base_cost_percent_increase),
      demolitionRefundPercent: percent(board.demolition_refund_bps),
    },
    ratesPerHour: {
      farmWheat: realmRatePerHour(ResourcesIds.Wheat),
      workshopLabor: perHour(board.workshop_rate),
      barracksKnights: realmRatePerHour(ResourcesIds.Knight),
      rangeCrossbows: realmRatePerHour(ResourcesIds.Crossbowman),
      lodgeScouts: realmRatePerHour(ResourcesIds.Paladin),
      researchStepPercent: percent(board.output_step_bps),
      rationStepWheat: whole(board.ration_step),
      wheatPerTroopMade: amountOf(
        definition.resources.production.find(({ resource_type }) => resource_type === ResourcesIds.Knight)!.recipe
          .simple_inputs,
        ResourcesIds.Wheat,
      ),
    },
    opensAtLevel: {
      range: research.RANGE_LEVEL,
      scoutsLodge: research.SCOUTS_LODGE_LEVEL,
      conscriptionCamp: research.CONSCRIPTION_CAMP_LEVEL,
      storeroom: research.STOREROOM_LEVEL,
      rationsDepot: research.RATIONS_DEPOT_LEVEL,
      supplyYard: research.SUPPLY_YARD_LEVEL,
    },
    research: researchPrices(),
    armies: {
      countByLevel: [limits.settlement_armies, limits.city_armies, limits.kingdom_armies, limits.empire_armies],
      largestByLevel: [
        limits.settlement_deployment_cap,
        limits.city_deployment_cap,
        limits.kingdom_deployment_cap,
        limits.empire_deployment_cap,
      ],
      wheatPerTroopPerTile: whole(stamina.stamina_travel_wheat_cost),
      wheatPerTroopPerReveal: whole(stamina.stamina_explore_wheat_cost),
      oathSlotsAtStart: research.OATH_SLOTS_BASE,
      oathSlotsToBuy: research.OATH_SLOTS_STEPS,
    },
    troops: {
      knightDamage: fixed(damage.t1_damage_value),
      damageFactor: fixed(damage.damage_scaling_factor),
      terrainBonus: damage.damage_biome_bonus_num,
      crossbowAndScoutDamagePercent: rules.FRONTIER_LIGHT_DAMAGE_PERCENT,
      knightGuardDamageTakenPercent: rules.FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT,
      scoutRevealStamina: rules.SCOUT_EXPLORE_STAMINA,
    },
    stamina: {
      reveal: stamina.stamina_explore_stamina_cost,
      move: stamina.stamina_travel_stamina_cost,
      attack: stamina.stamina_attack_req,
      defence: stamina.stamina_defense_req,
      wellPercent: rules.WELL_REFILL_PERCENT,
      perFragment: fragments.STAMINA_PER_FRAGMENT,
      logisticsStepPercent: rules.LOGISTICS_STEP_PERCENT,
    },
    oaths: {
      count: definition.settlement.order_aspects.length,
      passStamina: oaths.PASS_STAMINA,
      powerDamagePercent: oaths.POWER_DAMAGE_PERCENT,
      skillDamagePercent: oaths.SKILL_DAMAGE_PERCENT,
      skillBelowStamina: oaths.SKILL_BELOW_STAMINA,
      twinsDamagePercent: oaths.TWINS_DAMAGE_PERCENT,
      giantsReductionPercent: oaths.GIANTS_REDUCTION_PERCENT,
      protectionReductionPercent: oaths.PROTECTION_REDUCTION_PERCENT,
      vitriolLossPerTick: oaths.VITRIOL_LOSS_PER_TICK,
      angerAttackStamina: oaths.ANGER_ATTACK_STAMINA,
      furyRefundPercent: oaths.FURY_REFUND_PERCENT,
      titansStamina: oaths.TITANS_STAMINA,
      enlightenmentStaminaPerHour: Math.round(
        (stamina.stamina_gain_per_tick * STAMINA_TICKS_PER_HOUR * oaths.ENLIGHTENMENT_REGEN_BPS) / 10000,
      ),
      foxRevealDiscountPercent: oaths.FOX_REVEAL_DISCOUNT_PERCENT,
      reflectionWellPercent: oaths.REFLECTION_WELL_PERCENT,
      detectionEmptyRevealLimit: oaths.DETECTION_EMPTY_REVEAL_LIMIT,
      brilliancePayPercent: oaths.BRILLIANCE_PAY_PERCENT,
      ragePayPercent: oaths.RAGE_PAY_PERCENT,
      perfectionPayPercent: oaths.PERFECTION_PAY_PERCENT,
      perfectionLossPercent: oaths.PERFECTION_LOSS_PERCENT,
    },
    relics: {
      bladePercentPerTier: percent(rules.RELIC_BLADE_BPS),
      wardPercentPerTier: percent(rules.RELIC_WARD_BPS),
      plunderPercentPerTier: percent(rules.RELIC_PLUNDER_BPS),
      staminaRegenPercentPerTier: rules.STAMINA_REGEN_RELIC_STEP_PERCENT,
      secondsPerTier: definition.rules.relic_seconds_per_rank,
      tiers: rules.ATTRIBUTE_CAP,
      oddsPercentByLayer: layers.map(({ chest }) =>
        [chest.common, chest.uncommon, chest.rare, chest.epic, chest.legendary].map(percent),
      ),
    },
    exploration: {
      herdPercent: beastShare(rules.BEAST_HERD_SHARE),
      bandPercent: beastShare(rules.BEAST_BAND_SHARE),
      campPercent: percent(discovery.camp_bps),
      riftPercent: percent(discovery.rift_bps),
      ruinPercent: percent(discovery.ruin_bps),
      shrinePercent: percent(discovery.shrine_bps),
      wellPercent: percent(discovery.well_bps),
      emptyRevealsBeforeFind: discovery.empty_reveal_limit,
      spireFoundByReveal: rules.SPIRE_REVEAL_LIMIT,
      revealPayPercentByLayer: layers.map((layer) => layer.reveal_percent),
      revealCapByLayer: layers.map((layer) => layer.reveal_cap),
      riftEssencePercentByLayer: layers.map((layer) => percent(layer.rift_essence_bps)),
    },
    beasts: {
      herdByLayer: layers.map((layer) => centre(layer.beast_weak_lower, layer.beast_weak_upper)),
      bandByLayer: layers.map((layer) => centre(layer.beast_strong_lower, layer.beast_strong_upper)),
      campByLayer: layers.map((layer) => centre(layer.site_guard_lower, layer.site_guard_upper)),
      riftByLayer: layers.map((layer) => centre(layer.rift_guard_lower, layer.rift_guard_upper)),
      spreadPercent: widestSpreadPercent(),
    },
    fragments: {
      troopsPerCacheFragment: fragments.CACHE_TROOPS_PER_FRAGMENT,
      cachePercentByLayer: [
        fragments.SURFACE_CACHE_PERCENT,
        fragments.VEIL_CACHE_PERCENT,
        fragments.HOLLOW_CACHE_PERCENT,
      ],
      wonderQuest: fragments.WONDER_QUEST_FRAGMENTS,
      oathReroll: fragments.OATH_REROLL_FRAGMENTS,
      ancientSeal: fragments.SEAL_FRAGMENTS,
    },
    quest: {
      baseCounts: quests.base_counts,
      labor: Number(quests.labor),
      essence: Number(quests.essence),
      laborBonusPercent: quests.bonus_percent,
    },
    banes: {
      bar: deep.altar_threshold,
      quorumPercent: banes.quorum_percent,
      bloodMoonBeastPercent: banes.beast_percent,
      mistTideStaminaPercent: banes.stamina_percent,
      ashFallProductionPercent: banes.production_percent,
      stand: banes.quest_counts.slice(0, 4).map(Number),
      lights: banes.quest_counts.slice(4, 8).map(Number),
      cull: banes.quest_counts.slice(8, 12).map(Number),
    },
    triumphs: {
      clearMistPercent: seasonRace.clear_mist_percent,
      secondWindPercent: seasonRace.second_wind_percent,
      paleMoonPercent: seasonRace.pale_moon_percent,
      spoilsPercent: seasonRace.spoils_percent,
    },
    deep: {
      gateDistance: deep.gate_distance,
      rings: deep.rings,
      sitesPerRing: rules.DEEP_RING_SITES,
      siteKinds: rules.DEEP_KIND_COUNT,
      mapSize: rules.DEEP_MAP_SIZE,
      troopsLostPerTick: whole(deep.loss_per_tick),
      beasts: deep.beasts.map(({ count, bow }) => ({ troops: whole(count), bow })),
      buildingPay: deep.building_pay,
      coreEssencePerTick: whole(deep.core_per_tick),
      mineLaborPerTick: whole(deep.mine_per_tick),
      slots: rules.DEEP_GUARD_SLOTS,
    },
    race: { stageHeight: seasonRace.stage_height, stages: race.STAGE_COUNT },
  };
}

function widestSpreadPercent(): number {
  const spreads = layers.flatMap((layer) =>
    [
      [layer.beast_weak_lower, layer.beast_weak_upper],
      [layer.beast_strong_lower, layer.beast_strong_upper],
      [layer.site_guard_lower, layer.site_guard_upper],
      [layer.rift_guard_lower, layer.rift_guard_upper],
    ].map(([lower, upper]) => ((upper! - lower!) / 2 / centre(lower!, upper!)) * 100),
  );
  return hundredths(Math.max(...spreads));
}

describe("the Season 1 release against the design of record", () => {
  const generated = generatedSeasonOne();
  const systems = Object.keys(seasonOneDesign) as (keyof Design)[];

  test.each(systems)("%s holds the design's numbers", (system) => {
    expect(generated[system]).toEqual(seasonOneDesign[system]);
  });

  test("the starting labor covers a Workshop, a Barracks and a Farm", () => {
    const { workshop, barracks, farm } = generated.buildings;
    expect(generated.start.labor).toBeGreaterThanOrEqual(workshop.labor + barracks.labor + farm.labor);
  });

  test("non-Lore research rows grow with the building copy curve and training buildings keep explicit costs", () => {
    const growthBps = definition.rules.building_config.base_cost_percent_increase;
    for (const row of [
      research.ROW_FARM,
      research.ROW_WORKSHOP,
      research.ROW_CONSCRIPTION,
      research.ROW_RATIONS,
      research.ROW_SUPPLY_YARD,
      research.ROW_KNIGHT_OATHS,
      research.ROW_SCOUT_OATHS,
      research.ROW_CROSSBOW_OATHS,
    ]) {
      const steps = definition.structures.research
        .filter((step) => step.row === row)
        .toSorted((a, b) => a.tier - b.tier);
      const start = steps[0]!;
      for (const step of steps) {
        const scaleBps = 10_000n + BigInt((step.tier - 1) ** 2) * BigInt(growthBps);
        expect(BigInt(step.price.essence)).toBe((BigInt(start.price.essence) * scaleBps) / 10_000n);
        expect(BigInt(step.price.labor)).toBe((BigInt(start.price.labor) * scaleBps) / 10_000n);
      }
    }
    const costByCategory = (category: number) =>
      priceOf(definition.structures.buildings.find((row) => row.category === category)!.rule.simple_cost);
    expect(costByCategory(research.CONSCRIPTION_CAMP)).toEqual(seasonOneDesign.buildings.conscriptionCamp);
    expect(costByCategory(research.RATIONS_DEPOT)).toEqual(seasonOneDesign.buildings.rationsDepot);
    expect(costByCategory(research.SUPPLY_YARD)).toEqual(seasonOneDesign.buildings.supplyYard);
  });
});
