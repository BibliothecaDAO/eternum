import { nativeIdentifiers } from "../../../../contracts/l3/world-native/schema/client.gen";
import { CairoCustomEnum, CairoOption } from "starknet";
import type { DecodedRecord, DecodedWorldEvent } from "../types";
import type { NativeDecoder } from "./decoder";
import { encodeMembers } from "./serde";

type PresetRecord = Record<string, unknown>;
export type ReleaseRulesGame = { gameId: unknown; position: DecodedWorldEvent["position"] };
type EmitRule = (model: string, value: PresetRecord, key?: PresetRecord) => void;
const record = (value: unknown) => value as PresetRecord;
const records = (value: unknown) => value as PresetRecord[];
const some = (value: unknown): PresetRecord | undefined => {
  if (!(value instanceof CairoOption)) throw new Error("A release definition option is missing");
  return value.isSome() ? record(value.unwrap()) : undefined;
};

export function deriveReleaseFacts(
  decoder: NativeDecoder,
  definition: DecodedRecord,
  overrides: DecodedRecord,
  game: ReleaseRulesGame,
): DecodedWorldEvent[] {
  const rows: DecodedWorldEvent[] = [];
  const emit: EmitRule = (name, value, keys = {}) => {
    rows.push(derivedRow(decoder, game, name, value, keys));
  };
  deriveGameRules(emit, definition, overrides);
  deriveResources(emit, record(definition.resources));
  deriveStructures(emit, record(definition.structures));
  deriveSettlement(emit, record(definition.settlement));
  deriveEconomy(emit, record(definition.economy));
  return rows;
}

function derivedRow(
  decoder: NativeDecoder,
  game: ReleaseRulesGame,
  name: string,
  value: PresetRecord,
  keys: PresetRecord,
): DecodedWorldEvent {
  const schema = decoder.manifest.native.schemas[decoder.manifest.native.activeSchema]!;
  const model = schema.models.find((candidate) => candidate.name === name);
  if (!model) throw new Error(`Release rule model ${name} is absent from the schema`);
  const row = decoder.decodeRowSet(
    name,
    encodeMembers(schema, model.keys, { game_id: game.gameId, ...keys }),
    encodeMembers(schema, model.members, value),
  );
  return { ...row, position: game.position };
}

function deriveGameRules(emit: EmitRule, definition: DecodedRecord, overrides: DecodedRecord) {
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
    registration_limit: 0,
    mode:
      BigInt(rules.entry_rule as bigint) === BigInt(nativeIdentifiers.rule.ENTRY_ROSTER)
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
  for (const { row, tier, price } of records(structures.research)) emit("ResearchPrice", record(price), { row, tier });
  const board = some(structures.board);
  if (board) emit("BoardRules", board);
  emit("UpgradeLimits", record(structures.upgrade_limits));
  records(structures.upgrades).forEach((recipe, index) => emit("UpgradeRecipe", recipe, { level: index + 1 }));
}

function deriveSettlement(emit: EmitRule, settlement: PresetRecord) {
  emit("RealmGrants", record(settlement.realms));
  if (Array.isArray(settlement.order_aspects) && settlement.order_aspects.length > 0)
    emit("AspectRules", { orders: settlement.order_aspects });
  emit("VillageRules", record(settlement.villages));
  records(settlement.depths).forEach((rules, depth) => emit("DepthRules", rules, { depth }));
}

function deriveEconomy(emit: EmitRule, economy: PresetRecord) {
  if ("deep" in economy) {
    const deep = some(economy.deep);
    if (deep) emit("DeepRules", deep);
  }
  if ("race" in economy) {
    const race = some(economy.race);
    if (race) emit("RaceRules", race);
  }
  if ("banes" in economy) {
    const banes = some(economy.banes);
    if (banes) emit("BaneRules", banes);
  }
  if ("quests" in economy) {
    const quests = some(economy.quests);
    if (quests) emit("QuestRules", quests);
  }
}
