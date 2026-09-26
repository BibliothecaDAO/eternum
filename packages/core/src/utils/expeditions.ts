import { researchedDepths } from "./realm-research";
import { MAX_U32, ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { getNeighborHexes, StructureType } from "@bibliothecadao/types";
import { getBlockTimestamp } from "./timestamp";

import { entityMapPosition } from "./tile";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

type ExpeditionRuleModel = "SliceRules" | "GameRegistry" | "SettlementRules";
type ExpeditionRuleReader = (model: ExpeditionRuleModel) => Record<string, unknown> | undefined;

/** One reader for the clocks and grid, from the native store or Herald's fold. */
export const readExpeditionRules = (
  source: Pick<NativeFactStore, "get"> | ExpeditionRuleReader,
  gameId: number,
): { epochSeconds: number; spacing: number; startMainAt: number } | null => {
  const read: ExpeditionRuleReader =
    typeof source === "function" ? source : (model) => source.get(model, { game_id: gameId });
  const rules = read("SliceRules");
  const game = read("GameRegistry");
  if (!rules && game) throw new Error("Game subscription requires its rules");
  if (!rules || Number(rules.epoch_seconds) === 0) return null;
  const settlement = read("SettlementRules");
  if (!game || !settlement || Number(settlement.spacing) <= 0)
    throw new Error("Expedition scope requires game and settlement rules");
  return {
    epochSeconds: Number(rules.epoch_seconds),
    spacing: Number(settlement.spacing),
    startMainAt: Number(game.start_main_at),
  };
};

/** Absolute clock bucket used by expedition fact keys. */
export const absoluteEpoch = (rules: Pick<ExpeditionRules, "epochSeconds">, timestamp: number): number => {
  if (!Number.isSafeInteger(rules.epochSeconds) || rules.epochSeconds <= 0)
    throw new Error("Expedition epoch duration must be positive");
  return Math.floor(timestamp / rules.epochSeconds);
};

/** Zero-based season day; only this relative value selects a map region or allowance day. */
export const seasonDay = (rules: Pick<ExpeditionRules, "epochSeconds" | "startMainAt">, timestamp: number): number =>
  absoluteEpoch(rules, timestamp) - absoluteEpoch(rules, rules.startMainAt);

/**
 * What clearing a site pays home, as the contract's site_reward computes it from the guard it started with: a camp
 * half its troops in labor, a rift three times them in Essence, both in game precision; a fallen realm pays none (its
 * closed chest instead).
 */
export const siteReward = (
  site: Pick<NativeRows["ExpeditionSite"], "kind" | "initial_guard_count">,
): { resourceType: ResourcesIds; amount: bigint } | null => {
  if (site.kind === "Camp") return { resourceType: ResourcesIds.Labor, amount: site.initial_guard_count / 2n };
  if (site.kind === "Rift") return { resourceType: ResourcesIds.Essence, amount: site.initial_guard_count * 3n };
  return null;
};

/** The expedition map is laid out in bands of `spacing` rows, four per day: surface, then Ethereal I to III. */
const expeditionBand = (rules: ExpeditionRules, coord: { y: number }): number => Math.floor(coord.y / rules.spacing);

/** The depth a tile of the expedition map lies at, as the contract's depth_rules_at reads it. */
export const expeditionDepth = (rules: ExpeditionRules, coord: { y: number }): number =>
  expeditionBand(rules, coord) % 4;

/** When today's expedition ends: the next UTC epoch boundary, where the contract rolls every army and site over. */
export const expeditionDayEndsAt = (rules: Pick<ExpeditionRules, "epochSeconds">, nowSeconds: number): number =>
  (absoluteEpoch(rules, nowSeconds) + 1) * rules.epochSeconds;

/**
 * An army belongs to today's expedition only while it stands in today's region, as the contract's `is_current` decides;
 * an army from an earlier day may remain a fact, but every command refuses it.
 */
export const isCurrentExpeditionArmy = (
  rules: ExpeditionRules,
  coord: { x: number; y: number; alt: boolean },
  nowSeconds: number,
): boolean =>
  !coord.alt &&
  nowSeconds >= rules.startMainAt &&
  Math.floor(expeditionBand(rules, coord) / 4) === seasonDay(rules, nowSeconds);

/**
 * A structure's living field armies: troops left and, in a game with expeditions, standing in today's region. An army
 * from an earlier day is dead by rule: every command refuses it, and the contract destroys it before checking the army
 * cap when the realm next musters. So it never counts toward that cap or shows as the realm's army, even while its row
 * is still a fact. Today is judged at the execution floor, the time the next command will run at.
 */
export const liveHomeArmies = (
  store: Pick<NativeFactStore, "get" | "require" | "armiesAtHome" | "entityOccupancy">,
  structureId: number,
  gameId: number,
): NativeRows["ExplorerTroops"][] => {
  const armies = [...store.armiesAtHome(gameId, structureId)].filter((army) => army.troops.count > 0n);
  const rules = readExpeditionRules(store, gameId);
  if (!rules) return armies;
  const floorSeconds = getBlockTimestamp().currentDefaultTick;
  return armies.filter((army) =>
    isCurrentExpeditionArmy(rules, entityMapPosition(store, gameId, army.explorer_id), floorSeconds),
  );
};

/** A player's expedition home is a realm: its armies muster each day, and other structures are only met on the way. */
export const isRealmCategory = (category: number): boolean => category === StructureType.Realm;

/** Frontier realms occupy no stored tile; their daily sites follow the expedition rules. */
export const isExpeditionRealm = (
  store: Pick<NativeFactStore, "get" | "require">,
  structure: NativeRows["Structure"],
): boolean => isRealmCategory(structure.base.category) && readExpeditionRules(store, structure.game_id) !== null;

/** Frontier homes use their daily site; all other structures read their canonical occupancy. */
export const structureMapPosition = (
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  structure: NativeRows["Structure"],
): { x: number; y: number; alt: boolean } => {
  const rules = readExpeditionRules(store, structure.game_id);
  if (rules && isRealmCategory(structure.base.category)) {
    const site = expeditionRealmSite(rules, structure.metadata.realm_id, getBlockTimestamp().currentBlockTimestamp);
    return { x: site.col, y: site.row, alt: false };
  }
  return entityMapPosition(store, structure.game_id, structure.entity_id);
};

/** How many hexes the local view reads around its centre: its terrain disk's radius. */
export const LOCAL_VIEW_REACH = 2;

/**
 * The stable reference used to seed a realm's local terrain, independent of its daily map site. A Frontier realm's sits
 * off the map near the top of the tile key's range, far enough inside it that every hex the local view reads around it
 * is still a hex the store can key.
 */
export function structureLocalPosition(
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  structure: NativeRows["Structure"],
): { x: number; y: number; alt: boolean } {
  if (isExpeditionRealm(store, structure)) {
    const edge = Number(MAX_U32) - LOCAL_VIEW_REACH;
    return { x: edge - structure.metadata.realm_id, y: edge, alt: false };
  }
  return entityMapPosition(store, structure.game_id, structure.entity_id);
}

/** Where a realm stands on today's surface region: the site the contract computes for (realm id, day, depth 0). */
export const expeditionRealmSite = (
  rules: ExpeditionRules,
  realmId: number,
  nowSeconds: number,
): { col: number; row: number } => {
  const half = Math.floor(rules.spacing / 2);
  const day = seasonDay(rules, nowSeconds);
  return {
    col: (realmId - 1) * rules.spacing + half,
    row: day * 4 * rules.spacing + half,
  };
};

/**
 * The day's spire, which depth research lights: the home-ring tile in direction (day % 6) around today's site, turning one
 * step each day. The contract's enter_depth takes an army on or beside it; nothing stores it.
 */
export const expeditionSpireTile = (
  rules: ExpeditionRules,
  structure: NativeRows["Structure"],
  nowSeconds: number,
): { col: number; row: number } => {
  const site = expeditionRealmSite(rules, structure.metadata.realm_id, nowSeconds);
  const direction = seasonDay(rules, nowSeconds) % 6;
  const spire = getNeighborHexes(site.col, site.row).find((hex) => hex.direction === direction);
  if (!spire) throw new Error(`No hex in direction ${direction} around the expedition site`);
  return { col: spire.col, row: spire.row };
};

/** Whether an army stands where enter_depth takes it: on its realm's spire or beside it. */
export const isAtExpeditionSpire = (spire: { col: number; row: number }, coord: { x: number; y: number }): boolean =>
  (spire.col === coord.x && spire.row === coord.y) ||
  getNeighborHexes(spire.col, spire.row).some((hex) => hex.col === coord.x && hex.row === coord.y);

/** Every spire lit today that the store knows of: one per expedition realm with depth research. */
export const expeditionSpires = (
  store: Pick<NativeFactStore, "get" | "require" | "inGame">,
  gameId: number,
  nowSeconds: number,
): Array<{ col: number; row: number }> => {
  const rules = readExpeditionRules(store, gameId);
  if (!rules) return [];
  return [...store.inGame("Structure", gameId)]
    .filter(
      (structure) =>
        isExpeditionRealm(store, structure) &&
        (researchedDepths(store, structure.game_id, structure.entity_id)?.length ?? 0) > 0,
    )
    .map((structure) => expeditionSpireTile(rules, structure, nowSeconds));
};
