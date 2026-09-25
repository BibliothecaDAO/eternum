import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { CairoCustomEnum, CairoOption } from "starknet";
import type { DecodedRecord, DecodedWorldEvent } from "../types";
import type { NativeDecoder } from "./decoder";
import { encodeMembers } from "./serde";

/** ABI decoding has already checked every member and complete span in these records. */
type PresetRecord = Record<string, unknown>;
type EmitRule = (model: string, value: PresetRecord, key?: PresetRecord) => void;
const record = (value: unknown) => value as PresetRecord;
const records = (value: unknown) => value as PresetRecord[];
const some = (value: unknown): PresetRecord | undefined => {
  if (!(value instanceof CairoOption)) throw new Error("Decoded preset option is missing");
  return value.isSome() ? record(value.unwrap()) : undefined;
};

/** Configuration is a projection of the verified registration and the chain's immutable launch facts. */
export function derivePresetFacts(
  decoder: NativeDecoder,
  definition: DecodedRecord,
  overrides: DecodedRecord,
  registrationLimit: number,
  launch: DecodedWorldEvent,
): DecodedWorldEvent[] {
  const rows: DecodedWorldEvent[] = [];
  const emit: EmitRule = (name, value, keys = {}) => {
    rows.push(derivedRow(decoder, launch, name, value, keys));
  };
  deriveGameRules(emit, definition, overrides, registrationLimit);
  deriveResources(emit, record(definition.resources));
  deriveStructures(emit, record(definition.structures));
  deriveSettlement(emit, record(definition.settlement));
  deriveEconomy(emit, record(definition.economy));
  emit("ExtractionRewards", { rewards: definition.exploration });
  emit("SeasonWinThreshold", { points: definition.season_win_points });
  return rows;
}

function derivedRow(
  decoder: NativeDecoder,
  launch: DecodedWorldEvent,
  name: string,
  value: PresetRecord,
  keys: PresetRecord,
): DecodedWorldEvent {
  const schema = decoder.manifest.native.schemas[decoder.manifest.native.activeSchema]!;
  const model = schema.models.find((candidate) => candidate.name === name);
  if (!model) throw new Error(`Derived preset model ${name} is absent from the schema`);
  const row = decoder.decodeRowSet(
    name,
    encodeMembers(schema, model.keys, { game_id: launch.key.game_id, ...keys }),
    encodeMembers(schema, model.members, value),
  );
  return { ...row, position: launch.position };
}

function deriveGameRules(
  emit: EmitRule,
  definition: DecodedRecord,
  overrides: DecodedRecord,
  registrationLimit: number,
) {
  const rules = record(definition.rules);
  const settlement = record(definition.settlement);
  emit("SliceRules", {
    ...rules,
    biome_climate_config: overrides.biome_climate,
    map_config: overrides.map ?? rules.map_config,
    map_center_offset: overrides.map_center_offset,
  });
  emit("SettlementRules", {
    registration_start: overrides.registration_start,
    registration_limit: registrationLimit,
    mode:
      BigInt(rules.entry_rule as bigint) === BigInt(nativeRuleConstants.ENTRY_ROSTER)
        ? settlement.mode
        : new CairoCustomEnum({ Single: {} }),
    spacing: settlement.spacing,
  });
}

function deriveResources(emit: EmitRule, resources: PresetRecord) {
  for (const { resource_type, ...rule } of records(resources.resources)) emit("ResourceRule", rule, { resource_type });
  for (const { resource_type, recipe } of records(resources.production))
    emit("ProductionRecipe", record(recipe), { resource_type });
  for (const { kind, config } of records(resources.mine_kinds)) emit("MineKindConfig", record(config), { kind });
  emit("MinePool", { weights: resources.surface_mines });
}

function deriveStructures(emit: EmitRule, structures: PresetRecord) {
  for (const { category, rule } of records(structures.buildings)) emit("BuildingRule", record(rule), { category });
  const board = some(structures.board);
  if (board) emit("BoardRules", board);
  emit("CampResources", { resources: structures.camps });
  emit("FaithRules", record(structures.faith));
  emit("UpgradeLimits", record(structures.upgrade_limits));
  records(structures.upgrades).forEach((recipe, index) => emit("UpgradeRecipe", recipe, { level: index + 1 }));
}

function deriveSettlement(emit: EmitRule, settlement: PresetRecord) {
  emit("RealmGrants", record(settlement.realms));
  emit("VillageRules", record(settlement.villages));
  records(settlement.depths).forEach((rules, depth) => emit("DepthRules", rules, { depth }));
  const spires = some(settlement.spires);
  if (spires) emit("SpireLayout", spires);
}

function deriveEconomy(emit: EmitRule, economy: PresetRecord) {
  emit("TradeRules", record(economy.trade));
  emit("BankRules", record(economy.banks));
  emit("HyperstructureRules", record(economy.hyperstructures));
  emit("RelicRules", { rules: economy.relics });
  const chests = some(economy.chests);
  if (chests) emit("ChestRules", chests);
  // Older preset provenance predates progression; current registration requires it for expeditions.
  if ("progression" in economy) {
    const progression = some(economy.progression);
    if (progression) emit("ArmyProgressionRules", progression);
  }
  if ("discovery" in economy) {
    const discovery = some(economy.discovery);
    if (discovery) emit("FrontierDiscoveryRules", discovery);
  }
  emit("ArtificerCost", { research: economy.research_cost });
  const withdrawals = some(economy.withdrawals);
  if (withdrawals) {
    emit("DepositRules", record(withdrawals.deposits));
    emit("WithdrawalRules", record(withdrawals.rules));
    for (const { resource_type, token } of records(withdrawals.tokens))
      emit("ResourceToken", { token }, { resource_type });
  }
}
