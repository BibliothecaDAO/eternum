import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { getNeighborHexes, StructureType } from "@bibliothecadao/types";
import { getBlockTimestamp } from "./timestamp";

const EXPEDITION_SENTINEL_ROW = 0xffffffff;

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

/** The clocks and grid a Frontier game lays its daily regions on; null for games without expeditions. */
export const readExpeditionRules = (
  store: Pick<NativeFactStore, "get" | "require">,
  gameId: number,
): { epochSeconds: number; spacing: number; startMainAt: number } | null => {
  const rules = store.get("SliceRules", { game_id: gameId });
  if (!rules || rules.epoch_seconds === 0) return null;
  return {
    epochSeconds: rules.epoch_seconds,
    spacing: store.require("SettlementRules", { game_id: gameId }).spacing,
    startMainAt: Number(store.require("GameRegistry", { game_id: gameId }).start_main_at),
  };
};

/** Days since the season's first expedition, counted on UTC epoch boundaries as the contract does. */
export const expeditionEpoch = (rules: ExpeditionRules, nowSeconds: number): number =>
  Math.floor(nowSeconds / rules.epochSeconds) - Math.floor(rules.startMainAt / rules.epochSeconds);

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
  Math.floor(Math.floor(coord.y / rules.spacing) / 4) === expeditionEpoch(rules, nowSeconds);

/**
 * A structure's living field armies: troops left and, in a game with expeditions, standing in today's region. An army
 * from an earlier day is dead by rule: every command refuses it, and the contract destroys it before checking the army
 * cap when the realm next musters. So it never counts toward that cap or shows as the realm's army, even while its row
 * is still a fact. Today is judged at the execution floor, the time the next command will run at.
 */
export const liveHomeArmies = (
  store: Pick<NativeFactStore, "get" | "require" | "inGame">,
  structureId: number,
  gameId: number,
): NativeRows["ExplorerTroops"][] => {
  const armies = [...store.inGame("ExplorerTroops", gameId)].filter(
    (army) => army.owner === structureId && army.troops.count > 0n,
  );
  const rules = readExpeditionRules(store, gameId);
  if (!rules) return armies;
  const floorSeconds = getBlockTimestamp().currentDefaultTick;
  return armies.filter((army) => isCurrentExpeditionArmy(rules, army.coord, floorSeconds));
};

/** A Frontier realm keeps no map coordinate of its own: the contract parks it at a sentinel and raises it daily. */
export const isExpeditionRealm = (structure: NativeRows["Structure"]): boolean =>
  !structure.base.alt && structure.base.coord_y === EXPEDITION_SENTINEL_ROW;

/**
 * Where a structure stands on the world map. In a game with expeditions (epoch_seconds set, the contract's own
 * condition) a realm stands on the site the contract raises it on today; every other structure stands on its own
 * coordinate. This is the one rule for a structure's map position; the raw coordinate stays the key of its buildings
 * and tiles, never a place to point a camera at.
 */
export const structureMapPosition = (
  store: Pick<NativeFactStore, "get" | "require">,
  structure: NativeRows["Structure"],
): { x: number; y: number; alt: boolean } => {
  const rules = readExpeditionRules(store, structure.game_id);
  if (rules && structure.base.category === StructureType.Realm && !structure.base.alt) {
    const site = expeditionRealmSite(rules, structure, getBlockTimestamp().currentBlockTimestamp);
    return { x: site.col, y: site.row, alt: false };
  }
  if (isExpeditionRealm(structure)) {
    throw new Error(
      `Structure ${structure.entity_id} is parked at the expedition sentinel in a game without expeditions`,
    );
  }
  return { x: structure.base.coord_x, y: structure.base.coord_y, alt: structure.base.alt };
};

/** Where the realm stands on today's surface region: the site the contract computes for (realm, day, depth 0). */
export const expeditionRealmSite = (
  rules: ExpeditionRules,
  structure: NativeRows["Structure"],
  nowSeconds: number,
): { col: number; row: number } => {
  const half = Math.floor(rules.spacing / 2);
  const epoch = expeditionEpoch(rules, nowSeconds);
  return {
    col: (structure.metadata.realm_id - 1) * rules.spacing + half,
    row: epoch * 4 * rules.spacing + half,
  };
};

/**
 * The day's spire, which attunement lights: the home-ring tile in direction (day % 6) around today's site, turning one
 * step each day. The contract's enter_depth takes an army on or beside it; nothing stores it.
 */
export const expeditionSpireTile = (
  rules: ExpeditionRules,
  structure: NativeRows["Structure"],
  nowSeconds: number,
): { col: number; row: number } => {
  const site = expeditionRealmSite(rules, structure, nowSeconds);
  const direction = expeditionEpoch(rules, nowSeconds) % 6;
  const spire = getNeighborHexes(site.col, site.row).find((hex) => hex.direction === direction);
  if (!spire) throw new Error(`No hex in direction ${direction} around the expedition site`);
  return { col: spire.col, row: spire.row };
};

/** Whether an army stands where enter_depth takes it: on its realm's spire or beside it. */
export const isAtExpeditionSpire = (spire: { col: number; row: number }, coord: { x: number; y: number }): boolean =>
  (spire.col === coord.x && spire.row === coord.y) ||
  getNeighborHexes(spire.col, spire.row).some((hex) => hex.col === coord.x && hex.row === coord.y);

/** Every spire lit today that the store knows of: one per expedition realm with attunement. */
export const expeditionSpires = (
  store: Pick<NativeFactStore, "get" | "require" | "inGame">,
  gameId: number,
  nowSeconds: number,
): Array<{ col: number; row: number }> => {
  const rules = readExpeditionRules(store, gameId);
  if (!rules) return [];
  return [...store.inGame("Structure", gameId)]
    .filter((structure) => isExpeditionRealm(structure) && structure.metadata.attunement >= 1)
    .map((structure) => expeditionSpireTile(rules, structure, nowSeconds));
};
