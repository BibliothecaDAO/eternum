import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  blitzPointRules,
  blitzReleaseDefinition,
  type buildNativePreset,
  seasonOneReleaseDefinition,
} from "../../../../config/deployer/clean/config/native-preset";
import { blitzExplorationRewards } from "../../../../config/source/blitz/balance";
import { blitzPendingCommandMask } from "../../../../config/source/common/native-commands";
import { FRONTIER_S1_PRESET_ID } from "../../../../config/source/common/native-preset-modes";
import { nativePresetForId } from "../../../../config/source/native";
import { releaseDefinitionText } from "../../../../apps/herald/src/native/release-definition";
import { NATIVE_RELEASES } from "../../../../deploy/release/native-release";
import wireIds from "../schema/wire-ids.json";

type PresetDefinition = ReturnType<typeof buildNativePreset>;
type CairoValue = bigint | number | boolean | string | CairoRow;
type CairoRow = { [field: string]: CairoValue };
type CairoScalar = Exclude<CairoValue, CairoRow>;
type QuestRules = { base_counts: CairoScalar[]; labor: CairoScalar; essence: CairoScalar; bonus_percent: CairoScalar };
type BaneRules = {
  chance_step: CairoScalar;
  quorum_percent: CairoScalar;
  beast_percent: CairoScalar;
  stamina_percent: CairoScalar;
  production_percent: CairoScalar;
  quest_counts: CairoScalar[];
};

const FRONTIER = "the Frontier Season 1 preset";
const BLITZ = "the Blitz preset";
const world = new URL("../", import.meta.url);
const GAME_OVERRIDES = new Set(["biome_climate_config", "map_center_offset"]);
const SWITCHES = new Set(["command_mask", "mode_rules", "day_unit_seconds", "entry_rule"]);
const LOGIC_MODE_RULES = ["HOME_REWARDS", "UNOWNED_TARGETS", "DEPTH_CONTENTS", "REVEAL_SUPPLIES"];
const CHOOSE_OATH = wireIds.commands.find(({ name }) => name === "ChooseOath")!.id;
const RULE_SCALARS: Record<string, string> = { spire_travel_essence_cost: "u128", relic_seconds_per_rank: "u32" };

export function balanceModules(definition: PresetDefinition): Record<string, string> {
  assertPayWithinStage(definition.economy);
  return {
    resources: resourcesModule(definition.resources),
    structures: structuresModule(definition.structures, laborStores()),
    rules: rulesModule(definition.rules, assertSwitchesPlayable),
    expeditions: expeditionsModule(definition),
    quests: questsModule(present<QuestRules>(definition.economy.quests, "daily quests")),
    banes: banesModule(present<BaneRules>(definition.economy.banes, "world banes"), quietDays()),
    deep: deepModule(present<DeepRow>(definition.economy.deep, "the Deep")),
    race: raceModule(present<CairoRow>(definition.economy.race, "the race")),
    settlement: settlementModule(definition.settlement),
  };
}

export function blitzBalanceModules(definition: PresetDefinition): Record<string, string> {
  return {
    resources: resourcesModule(definition.resources),
    structures: blitzStructuresModule(definition.structures),
    rules: [
      rulesModule(definition.rules, assertBlitzSwitches),
      number("PENDING_COMMANDS", "u128", blitzPendingCommandMask),
    ].join("\n\n"),
    settlement: blitzSettlementModule(definition.settlement),
    points: blitzPointsModule(blitzPointRules()),
    exploration: blitzExplorationModule(blitzExplorationRewards),
  };
}

export function writeRelease(frontier: PresetDefinition, blitz: PresetDefinition): void {
  writeBalanceModules(balanceModules(frontier), blitzBalanceModules(blitz));
  writeFileSync(
    new URL("schema/release-definition.json", world),
    releaseDefinitionText(NATIVE_RELEASES.frontier.release, frontier),
  );
}

function writeBalanceModules(frontier: Record<string, string>, blitz: Record<string, string>): void {
  mkdirSync(new URL("src/balance/blitz/", world), { recursive: true });
  const paths = [
    writeModule("src/balance.cairo", "the release definitions", familyDeclarations(frontier, blitz)),
    ...Object.entries(frontier).map(([group, body]) => writeModule(`src/balance/${group}.cairo`, FRONTIER, [body])),
    writeModule(
      "src/balance/blitz.cairo",
      BLITZ,
      Object.keys(blitz).map((group) => `pub mod ${group};`),
    ),
    ...Object.entries(blitz).map(([group, body]) => writeModule(`src/balance/blitz/${group}.cairo`, BLITZ, [body])),
  ];
  for (const path of paths) execFileSync("scarb", ["fmt", path], { cwd: fileURLToPath(world), encoding: "utf8" });
}

function familyDeclarations(frontier: Record<string, string>, blitz: Record<string, string>): string[] {
  return [
    '#[cfg(feature: "blitz")]',
    "mod blitz;",
    '#[cfg(feature: "blitz")]',
    `pub use blitz::{${Object.keys(blitz).join(", ")}};`,
    ...Object.keys(frontier).flatMap((group) => ['#[cfg(not(feature: "blitz"))]', `pub mod ${group};`]),
  ];
}

function writeModule(path: string, source: string, lines: string[]): string {
  const file = fileURLToPath(new URL(path, world));
  const header = `// @generated by scripts/balance-modules.ts from ${source}. DO NOT EDIT.`;
  writeFileSync(file, [header, ...lines].join("\n") + "\n");
  return file;
}

function resourcesModule(resources: PresetDefinition["resources"]): string {
  const inputs: CairoRow[] = [];
  const recipes = resources.production.map(({ recipe }) => {
    const first_input = inputs.length;
    inputs.push(...recipe.simple_inputs, ...recipe.complex_inputs);
    return {
      simple_output: recipe.simple_output,
      complex_output: recipe.complex_output,
      first_input,
      simple_count: recipe.simple_inputs.length,
      complex_count: recipe.complex_inputs.length,
    };
  });
  const kinds = resources.mine_kinds.map(({ kind, config }, index) => {
    if (kind !== index + 1)
      throw new Error(`Mine kinds must number 1 to ${resources.mine_kinds.length}, found ${kind}`);
    return config;
  });
  return [
    "use crate::mines::{MineKindConfig, MineWeight};",
    "use crate::production::RecipeRow;",
    "use crate::resources::{ResourceAmount, ResourceRule};",
    table("RESOURCE_RULES", "ResourceRule", resources.resources),
    table("RECIPES", "RecipeRow", recipes),
    table("RECIPE_INPUTS", "ResourceAmount", inputs),
    table("MINE_KINDS", "MineKindConfig", kinds),
    table("SURFACE_MINES", "MineWeight", resources.surface_mines),
  ].join("\n\n");
}

function laborStores(): readonly number[] {
  const stores = nativePresetForId(FRONTIER_S1_PRESET_ID).board?.laborStoreCaps;
  if (!stores) throw new Error("The release's preset must name its castle labor stores");
  return stores;
}

function structuresModule(structures: PresetDefinition["structures"], labor: readonly number[]): string {
  const board = present<CairoRow>(structures.board, "a realm board");
  return [
    "use crate::buildings::{BoardRules, BuildingRow};",
    "use crate::research::ResearchPrice;",
    "use crate::resources::ResourceAmount;",
    "use crate::upgrades::UpgradeRow;",
    record("BOARD", "BoardRules", board),
    `pub const LABOR_STORES: [u32; ${labor.length}] = [${labor.join(", ")}];`,
    ...buildingTables(structures),
    table("RESEARCH_PRICES", "ResearchPrice", researchPrices(structures.research)),
    ...growthTables(structures),
  ].join("\n\n");
}

function blitzPointsModule({
  explore_points,
  capture_points,
  hyperstructure_capture_points,
  hold_points_per_second,
}: ReturnType<typeof blitzPointRules>): string {
  return [
    number("EXPLORE_POINTS", "u128", explore_points),
    number("CAPTURE_POINTS", "u128", capture_points),
    number("HYPERSTRUCTURE_CAPTURE_POINTS", "u128", hyperstructure_capture_points),
    number("HOLD_POINTS_PER_SECOND", "u128", hold_points_per_second),
  ].join("\n\n");
}

function blitzExplorationModule(rewards: typeof blitzExplorationRewards): string {
  if (rewards.length === 0 || rewards.some(({ weight }) => weight <= 0))
    throw new Error("A Blitz reveal pays from a pool of weighted rows");
  return [
    "use crate::exploration_rewards::ExplorationReward;",
    table("EXPLORATION_REWARDS", "ExplorationReward", rewards),
  ].join("\n\n");
}

function blitzStructuresModule(structures: PresetDefinition["structures"]): string {
  if (structures.board.isSome() || structures.research.length !== 0)
    throw new Error("Blitz has no realm board and no research");
  return [
    "use crate::buildings::BuildingRow;",
    "use crate::resources::ResourceAmount;",
    "use crate::upgrades::UpgradeRow;",
    ...buildingTables(structures),
    ...growthTables(structures),
  ].join("\n\n");
}

function buildingTables(structures: PresetDefinition["structures"]): string[] {
  const buildingCosts: CairoRow[] = [];
  const buildings = structures.buildings.map(({ category, rule }, index) => {
    if (category !== index + 1) throw new Error(`Building categories must number 1 to ${structures.buildings.length}`);
    const first_cost = buildingCosts.length;
    buildingCosts.push(...rule.simple_cost, ...rule.complex_cost);
    return {
      population_cost: rule.population_cost,
      capacity_grant: rule.capacity_grant,
      first_cost,
      simple_count: rule.simple_cost.length,
      complex_count: rule.complex_cost.length,
    };
  });
  return [table("BUILDINGS", "BuildingRow", buildings), table("BUILDING_COSTS", "ResourceAmount", buildingCosts)];
}

function growthTables(structures: PresetDefinition["structures"]): string[] {
  const upgradeCosts: CairoRow[] = [];
  const upgrades = structures.upgrades.map(({ costs }) => {
    const first_cost = upgradeCosts.length;
    upgradeCosts.push(...costs);
    return { first_cost, cost_count: costs.length };
  });
  return [
    table("CAMP_GRANTS", "ResourceAmount", structures.camps.resources),
    number("CAMP_LABOR_RATE", "u64", structures.camps.labor_rate),
    number("REALM_UPGRADE_MAX", "u8", structures.upgrade_limits.realm_max),
    number("VILLAGE_UPGRADE_MAX", "u8", structures.upgrade_limits.village_max),
    table("UPGRADES", "UpgradeRow", upgrades),
    table("UPGRADE_COSTS", "ResourceAmount", upgradeCosts),
  ];
}

function researchPrices(research: PresetDefinition["structures"]["research"]): CairoRow[] {
  const sorted = research.toSorted((left, right) => left.row - right.row || left.tier - right.tier);
  sorted.forEach(({ row, tier }, index) => {
    const previous = sorted[index - 1];
    const expected = previous?.row === row ? previous.tier + 1 : 1;
    if (tier !== expected) throw new Error(`Research row ${row} must price tiers from 1 in turn, found tier ${tier}`);
  });
  return sorted.map(({ price }) => price);
}

function record(name: string, type: string, row: CairoRow, nested: Record<string, string> = {}): string {
  return `pub const ${name}: ${type} = ${struct(type, row, nested)};`;
}

function number(name: string, type: string, value: CairoValue): string {
  return `pub const ${name}: ${type} = ${scalar(name, type, value)};`;
}

function rulesModule(
  rules: PresetDefinition["rules"],
  assertPlayable: (rules: PresetDefinition["rules"]) => void,
): string {
  assertPlayable(rules);
  return Object.entries(rules)
    .filter(([field]) => !GAME_OVERRIDES.has(field) && !SWITCHES.has(field))
    .map(([field, value]) => {
      const name = field.toUpperCase();
      if (typeof value === "object") return record(name, `crate::rules::${pascalCase(field)}`, value as CairoRow);
      const type = RULE_SCALARS[field];
      if (!type) throw new Error(`Rule ${field} has no Cairo type`);
      return number(name, type, value as CairoValue);
    })
    .concat(record("SWITCHES", "crate::rules::ReleaseSwitches", releaseSwitches(rules)))
    .join("\n\n");
}

function releaseSwitches(rules: PresetDefinition["rules"]): CairoRow {
  return Object.fromEntries([...SWITCHES].map((field) => [field, (rules as Record<string, CairoValue>)[field]]));
}

function assertSwitchesPlayable(rules: PresetDefinition["rules"]): void {
  const day = Number(rules.day_unit_seconds);
  const tick = Number(rules.tick_config.armies_tick_in_seconds);
  if (Number(rules.entry_rule) !== cairoConstant("src/rules.cairo", "ENTRY_OPEN"))
    throw new Error("Season 1 entry is open: the release seats no fixed roster");
  if (
    Number(rules.mode_rules) !==
    LOGIC_MODE_RULES.reduce((mask, name) => mask | cairoConstant("src/rules.cairo", name), 0)
  )
    throw new Error(`The logic plays ${LOGIC_MODE_RULES.join(", ")} and no other mode rule`);
  if (((BigInt(String(rules.command_mask)) >> BigInt(CHOOSE_OATH)) & 1n) === 0n)
    throw new Error("The logic always offers an oath: the release must take ChooseOath");
  if (day === 0 || tick === 0 || day % tick !== 0) throw new Error("Season 1 days are whole army ticks");
}

function assertBlitzSwitches(rules: PresetDefinition["rules"]): void {
  if (Number(rules.entry_rule) !== cairoConstant("src/rules.cairo", "ENTRY_ROSTER"))
    throw new Error("Blitz seats a fixed roster: its entry is not open");
  if (Number(rules.day_unit_seconds) !== 0) throw new Error("Blitz has no day calendar: its day unit is zero");
}

function deepModule(deep: DeepRow): string {
  const { rings, beasts, ...settings } = deep;
  assertDeepPlayable(deep);
  return [
    record(
      "DEEP_SETTINGS",
      "crate::deep::DeepSettings",
      { ...(settings as CairoRow), ring_count: rings.length },
      { building_pay: "crate::deep::DeepPay" },
    ),
    table("DEEP_RINGS", "crate::deep::DeepRing", rings),
    table("DEEP_BEASTS", "crate::deep::DeepBeast", beasts),
  ].join("\n\n");
}

function raceModule(race: CairoRow): string {
  assertRacePlayable(race);
  return record("RACE_RULES", "crate::race::RaceRules", race);
}

type DeepRow = { rings: CairoRow[]; beasts: CairoRow[]; building_pay: CairoRow; [field: string]: unknown };

function assertDeepPlayable(deep: DeepRow): void {
  const precision = cairoConstant("src/rules.cairo", "RESOURCE_PRECISION");
  const whole = (value: unknown) => Number(value) !== 0 && Number(value) % precision === 0;
  const refuse = (reason: string) => {
    throw new Error(`Season 1 Deep: ${reason}`);
  };
  if (deep.beasts.length !== cairoConstant("src/rules.cairo", "DEEP_KIND_COUNT")) refuse("a beast for every kind");
  if (!deep.beasts.every((beast) => whole(beast.count))) refuse("a beast is whole troops");
  if (!whole(deep.loss_per_tick)) refuse("the tick loss is whole troops");
  if (Number(deep.core_per_tick) === 0 || Number(deep.mine_per_tick) === 0) refuse("empty payment");
  const pay = (tier: string) => Number(deep.building_pay[tier]);
  if (pay("crowd") === 0 || pay("pair") < pay("crowd") || pay("alone") < pay("pair")) refuse("invalid building pay");
  if (Number(deep.altar_threshold) === 0) refuse("empty Altar bar");
  const rings = deep.rings.map((ring) => ({ radius: Number(ring.radius), realms: Number(ring.realms) }));
  if (rings.length === 0 || rings.length > cairoConstant("src/rules.cairo", "DEEP_RING_LIMIT")) refuse("ring count");
  if (rings[0].realms !== 0) refuse("the first ring opens with the day");
  if (rings.some((ring, index) => ring.radius === 0 || (index > 0 && ring.realms <= rings[index - 1].realms)))
    refuse("rings open in order");
}

function assertPayWithinStage(economy: PresetDefinition["economy"]): void {
  const deep = economy.deep.unwrap() as unknown as DeepRow | undefined;
  const race = economy.race.unwrap() as unknown as CairoRow | undefined;
  if (deep && race && Number(deep.building_pay.alone) > Number(race.stage_height))
    throw new Error("Season 1 Deep: one tick's building pay passes a race stage");
}

function assertRacePlayable(race: CairoRow): void {
  const n = (field: string) => Number(race[field]);
  const refuse = (reason: string) => {
    throw new Error(`Season 1 race: ${reason}`);
  };
  if (n("season_days") === 0 || n("season_days") % cairoConstant("src/day_schedule.cairo", "DAYS_PER_BAG") !== 0)
    refuse("whole day bags");
  if (n("stage_height") === 0) refuse("zero height stage");
  for (const field of ["clear_mist_percent", "second_wind_percent", "spoils_percent"])
    if (n(field) < 100 || n(field) > 200) refuse(`invalid ${field}`);
  if (n("pale_moon_percent") <= 0 || n("pale_moon_percent") > 100) refuse("invalid pale_moon_percent");
}

function cairoConstant(path: string, name: string): number {
  const value = readFileSync(new URL(path, world), "utf8").match(new RegExp(`pub const ${name}: u\\d+ = (\\d+);`))?.[1];
  if (value === undefined) throw new Error(`${path} defines no ${name}`);
  return Number(value);
}

function pascalCase(field: string): string {
  return field.replace(/(^|_)([a-z])/g, (_match, _separator, letter: string) => letter.toUpperCase());
}

function expeditionsModule(definition: PresetDefinition): string {
  const depths: CairoRow[] = definition.settlement.depths.map((depth) => ({ ...depth, chest: { ...depth.chest } }));
  if (depths.length !== 3) throw new Error(`Season 1 has three layers to reveal, found ${depths.length}`);
  depths.forEach(assertDepthPlayable);
  const discovery = definition.economy.discovery.unwrap() as CairoRow | undefined;
  if (!discovery) throw new Error("Season 1 discovers sites: its discovery rules are required");
  const race = definition.economy.race.unwrap() as CairoRow | undefined;
  assertDiscoveryFits(discovery, Number(race?.clear_mist_percent ?? 100));
  return [
    "use crate::expeditions::{DepthRules, FrontierDiscoveryRules};",
    "use crate::relics::ChestTiers;",
    table("DEPTH_RULES", "DepthRules", depths, { chest: "ChestTiers" }),
    `pub const FRONTIER_DISCOVERY: FrontierDiscoveryRules = ${struct("FrontierDiscoveryRules", discovery)};`,
  ].join("\n\n");
}

function settlementModule(settlement: PresetDefinition["settlement"]): string {
  const { spacing, order_aspects: orderAspects, realms, villages } = settlement;
  const startingTroops = realms.starting_troops.map((troop) => troop.activeVariant());
  assertSettlementFits(spacing, orderAspects, startingTroops, realms.realm_resources);
  assertVillagePoolComplete(villages.resource_pool);
  if (settlement.spires.isSome()) throw new Error("Season 1 places no spires: its preset names a layout");
  return [
    "use crate::resources::ResourceAmount;",
    "use crate::troops::TroopType;",
    "use crate::village::VillageResource;",
    `pub const SETTLEMENT_SPACING_STEPS: u32 = ${spacing};`,
    list("ORDER_ASPECTS", "u8", orderAspects.map(String)),
    table("REALM_GRANTS", "ResourceAmount", realms.resources),
    list(
      "STARTING_TROOPS",
      "TroopType",
      startingTroops.map((troop) => `TroopType::${troop}`),
    ),
    list("REALM_RESOURCES", "u8", realms.realm_resources.map(String)),
    `pub const VILLAGE_TROOP_DELAY_TICK_COUNT: u16 = ${villages.troop_delay_ticks};`,
    table("VILLAGE_GRANTS", "ResourceAmount", villages.resources),
    table("VILLAGE_RESOURCE_POOL", "VillageResource", villages.resource_pool),
  ].join("\n\n");
}

function blitzSettlementModule(settlement: PresetDefinition["settlement"]): string {
  const { spacing, realms, villages } = settlement;
  if (settlement.order_aspects.length !== 0 || realms.starting_troops.length !== 0 || settlement.depths.length !== 0)
    throw new Error("Blitz has no Aspects, no dealt troop types and no depths");
  if (!Number.isSafeInteger(spacing) || spacing < 2 || spacing % 2)
    throw new Error("Blitz settlement spacing must be an even number of steps");
  assertRealmResources(realms.realm_resources);
  assertVillagePoolComplete(villages.resource_pool);
  return [
    "use crate::resources::ResourceAmount;",
    "use crate::village::VillageResource;",
    `pub const SETTLEMENT_SPACING_STEPS: u32 = ${spacing};`,
    table("REALM_GRANTS", "ResourceAmount", realms.resources),
    list("REALM_RESOURCES", "u8", realms.realm_resources.map(String)),
    `pub const VILLAGE_TROOP_DELAY_TICK_COUNT: u16 = ${villages.troop_delay_ticks};`,
    table("VILLAGE_GRANTS", "ResourceAmount", villages.resources),
    table("VILLAGE_RESOURCE_POOL", "VillageResource", villages.resource_pool),
  ].join("\n\n");
}

function assertSettlementFits(
  spacing: number,
  orderAspects: number[],
  troops: string[],
  realmResources: number[],
): void {
  if (!Number.isSafeInteger(spacing) || spacing < 16 || spacing % 2)
    throw new Error("Season 1 settlement spacing must be an even number of at least 16");
  if (spacing * cairoConstant("src/realms.cairo", "CANONICAL_REALM_COUNT") >= 0x7fffffff)
    throw new Error("Season 1 settlement spacing exhausts the map");
  if (orderAspects.length !== 16) throw new Error("Season 1 Aspects need every Order");
  for (const aspect of [1, 2, 3, 4])
    if (orderAspects.filter((held) => held === aspect).length !== 4)
      throw new Error(`Season 1 Aspect ${aspect} needs four Orders`);
  if (troops.length !== 17) throw new Error("Season 1 names one starting troop type per biome");
  assertRealmResources(realmResources);
}

function assertRealmResources(realmResources: number[]): void {
  if (realmResources.length > 16) throw new Error("Realm resources exceed packed capacity");
  if (realmResources.some((resource) => resource < 1 || resource > 58))
    throw new Error("The release names an invalid realm resource");
}

function assertVillagePoolComplete(pool: Array<{ resource_type: number; weight: number | bigint }>): void {
  if (pool.length !== 22) throw new Error("The village resource pool is incomplete");
  if (pool.some(({ resource_type, weight }) => resource_type < 1 || resource_type > 22 || weight <= 0))
    throw new Error("The village resource pool holds an invalid outcome");
  if (new Set(pool.map(({ resource_type }) => resource_type)).size !== pool.length)
    throw new Error("The village resource pool repeats an outcome");
}

function assertDepthPlayable(depth: CairoRow, layer: number): void {
  const relicsPerLayer = cairoConstant("src/army_relics.cairo", "RELICS_PER_LAYER");
  const n = (field: string) => Number(depth[field]);
  const chest = Object.values(depth.chest as CairoRow).map(Number);
  const refuse = (reason: string) => {
    throw new Error(`Season 1 depth ${layer}: ${reason}`);
  };
  if (chest.reduce((sum, odds) => sum + odds, 0) !== 10_000) refuse("chest odds must sum to 100 percent");
  if (chest.some((odds, rank) => odds !== 0 && (rank < layer || rank >= layer + relicsPerLayer)))
    refuse("a layer's ruins hold only its three relics");
  if (n("reveal_percent") === 0 || n("reveal_percent") > 100) refuse("invalid reveal percentage");
  if (n("site_guard_lower") === 0 || n("site_guard_lower") > n("site_guard_upper")) refuse("invalid site guards");
  if (n("rift_guard_lower") === 0 || n("rift_guard_lower") > n("rift_guard_upper")) refuse("invalid rift guards");
  const guardBounds = ["site_guard_lower", "site_guard_upper", "rift_guard_lower", "rift_guard_upper"];
  if (n("guard_step") === 0 || guardBounds.some((field) => n(field) % n("guard_step")))
    refuse("guard bounds off the guard grid");
  if (n("beast_weak_lower") === 0 || n("beast_weak_lower") > n("beast_weak_upper")) refuse("invalid weak beasts");
  if (n("beast_strong_lower") > n("beast_strong_upper")) refuse("invalid strong beasts");
  if (n("beast_weak_upper") >= n("beast_strong_lower")) refuse("beast ranges overlap");
  if (n("beast_strong_upper") >= n("site_guard_lower")) refuse("beasts must be weaker than sites");
}

function assertDiscoveryFits(rules: CairoRow, clearMistPercent: number): void {
  const bps = (field: string) => Number(rules[field]);
  const weights = ["beasts_bps", "camp_bps", "rift_bps", "ruin_bps", "shrine_bps", "well_bps"].map(bps);
  const limit = Number(rules.empty_reveal_limit);
  if (weights.some((weight) => !Number.isSafeInteger(weight) || weight < 0 || weight > 10_000))
    throw new Error("Season 1 discovery weights must lie between 0 and 10,000 basis points");
  if (limit < 1 || limit > 255) throw new Error("Season 1 discovery needs an empty-reveal floor of 1 to 255");
  if (bps("beasts_bps") + bps("camp_bps") + bps("rift_bps") === 0)
    throw new Error("Season 1 discovery floor finds no guarded site");
  const widest = Math.max(bps("shrine_bps") + bps("well_bps"), bps("camp_bps"), bps("rift_bps"));
  const finds = weights.reduce((sum, weight) => sum + weight, 0) + widest;
  if (finds * clearMistPercent > 1_000_000)
    throw new Error("Season 1 discovery under Clear Mist exceeds one hundred percent");
}

function questsModule(quests: QuestRules): string {
  assertQuestsPlayable(quests);
  return [
    numbers("BASE_COUNTS", "u32", quests.base_counts),
    number("LABOR_AMOUNT", "u128", quests.labor),
    number("ESSENCE_AMOUNT", "u128", quests.essence),
    number("BONUS_PERCENT", "u16", quests.bonus_percent),
  ].join("\n\n");
}

function quietDays(): number {
  const banes = nativePresetForId(FRONTIER_S1_PRESET_ID).banes;
  if (!banes) throw new Error("The release's preset must have world banes");
  return banes.quietDays;
}

function banesModule(banes: BaneRules, quietDays: number): string {
  assertBanesPlayable(banes, quietDays);
  return [
    number("QUIET_DAYS", "u64", quietDays),
    number("CHANCE_STEP_PERCENT", "u16", banes.chance_step),
    number("QUORUM_PERCENT", "u16", banes.quorum_percent),
    number("BEAST_PERCENT", "u16", banes.beast_percent),
    number("STAMINA_PERCENT", "u16", banes.stamina_percent),
    number("PRODUCTION_PERCENT", "u16", banes.production_percent),
    numbers("QUEST_COUNTS", "u128", banes.quest_counts),
  ].join("\n\n");
}

function assertQuestsPlayable(quests: QuestRules): void {
  const refuse = (reason: string) => {
    throw new Error(`Season 1 quests: ${reason}`);
  };
  if (quests.base_counts.length !== cairoConstant("src/quests.cairo", "QUEST_COUNT")) refuse("a bag of seven quests");
  if (quests.base_counts.some((count) => Number(count) === 0)) refuse("empty quest target");
  const labor = BigInt(quests.labor);
  const essence = BigInt(quests.essence);
  if (labor === 0n || essence === 0n) refuse("empty quest reward");
  if (Number(quests.bonus_percent) < 100) refuse("the bonus reduces the reward");
  const largest = ((1n << 128n) - 1n) / BigInt(cairoConstant("src/rules.cairo", "RESOURCE_PRECISION"));
  if ((labor * 8n * BigInt(quests.bonus_percent)) / 100n > largest || essence * 8n > largest)
    refuse("the reward exceeds a resource amount");
}

function assertBanesPlayable(banes: BaneRules, quietDays: number): void {
  const percent = (field: Exclude<keyof BaneRules, "quest_counts">) => Number(banes[field]);
  const within = (value: number) => value > 0 && value <= 100;
  const refuse = (reason: string) => {
    throw new Error(`Season 1 banes: ${reason}`);
  };
  if (!within(percent("chance_step")) || !within(percent("quorum_percent"))) refuse("invalid chance or quorum");
  if (!Number.isSafeInteger(quietDays) || quietDays < 0) refuse("invalid quiet days");
  if (percent("beast_percent") < 100) refuse("a world bane weakens beasts");
  if (!within(percent("stamina_percent")) || !within(percent("production_percent"))) refuse("invalid rate");
  if (banes.quest_counts.length !== 12 || banes.quest_counts.some((count) => Number(count) === 0))
    refuse("four Realm levels of quest targets for each bane");
}

function present<T>(option: { unwrap(): unknown }, group: string): T {
  const value = option.unwrap();
  if (value === undefined) throw new Error(`The release's preset must have ${group}`);
  return value as T;
}

function numbers(name: string, type: string, values: CairoValue[]): string {
  return `pub const ${name}: [${type}; ${values.length}] = [${values.map((value) => scalar(name, type, value)).join(", ")}];`;
}

function table(name: string, type: string, rows: CairoRow[], nested: Record<string, string> = {}): string {
  return `pub const ${name}: [${type}; ${rows.length}] = [${rows.map((row) => struct(type, row, nested)).join(", ")}];`;
}

function list(name: string, type: string, values: string[]): string {
  return `pub const ${name}: [${type}; ${values.length}] = [${values.join(", ")}];`;
}

function struct(type: string, row: CairoRow, nested: Record<string, string> = {}): string {
  return `${type} { ${Object.entries(row)
    .map(([field, value]) => {
      const inner = nested[field];
      return `${field}: ${inner ? struct(inner, value as unknown as CairoRow) : scalar(type, field, value)}`;
    })
    .join(", ")} }`;
}

function scalar(type: string, field: string, value: CairoValue): string {
  if (typeof value === "object") throw new Error(`${type}.${field} is a struct with no Cairo type named for it`);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "bigint" || (typeof value === "number" && Number.isSafeInteger(value))) return String(value);
  if (typeof value === "string" && /^(0x[0-9a-f]+|[0-9]+)$/i.test(value)) return value;
  throw new Error(`${type}.${field} is not a whole number: ${String(value)}`);
}

if (import.meta.main) writeRelease(seasonOneReleaseDefinition(), blitzReleaseDefinition());
