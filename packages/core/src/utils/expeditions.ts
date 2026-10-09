import { researchedDepth } from "./realm-research";
import { MAX_U32, ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { getNeighborHexes, StructureType } from "@bibliothecadao/types";
import { getBlockTimestamp } from "./timestamp";
import { dayOf } from "./days";

import { entityMapPosition } from "./tile";

export * from "./days";

export type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

type ExpeditionRuleModel = "SliceRules" | "GameRegistry" | "SettlementRules";
type ExpeditionRuleReader = (model: ExpeditionRuleModel) => Record<string, unknown> | undefined;

/** One reader for the season's calendar and grid, from the native store or Herald's fold. */
export const readExpeditionRules = (
  source: Pick<NativeFactStore, "get"> | ExpeditionRuleReader,
  gameId: number,
): { dayUnitSeconds: number; spacing: number; startMainAt: number; seed: bigint } | null => {
  const read: ExpeditionRuleReader =
    typeof source === "function" ? source : (model) => source.get(model, { game_id: gameId });
  const rules = read("SliceRules");
  const game = read("GameRegistry");
  if (!rules && game) throw new Error("Game subscription requires its rules");
  if (!rules || Number(rules.day_unit_seconds) === 0) return null;
  const settlement = read("SettlementRules");
  if (!game || !settlement || Number(settlement.spacing) <= 0)
    throw new Error("Expedition scope requires game and settlement rules");
  return {
    dayUnitSeconds: Number(rules.day_unit_seconds),
    spacing: Number(settlement.spacing),
    startMainAt: Number(game.start_main_at),
    seed: BigInt(game.seed as bigint | string),
  };
};

/** The season day an expedition timestamp falls in: its index keys the day's map region and every per-day fact. */
export const seasonDay = (rules: ExpeditionRules, timestamp: number): number | null =>
  dayOf(rules, timestamp)?.index ?? null;

/** A guarded Frontier site's kind is its structure category. */
export type SiteKind = "Camp" | "Rift" | "Ruin" | "Stragglers";
const SITE_KINDS = new Map<number, SiteKind>([
  [StructureType.Camp, "Camp"],
  [StructureType.Rift, "Rift"],
  [StructureType.Ruin, "Ruin"],
  [StructureType.Stragglers, "Stragglers"],
]);
export const siteKindOf = (category: number): SiteKind => {
  const kind = SITE_KINDS.get(category);
  if (!kind) throw new Error(`Structure category ${category} is not a guarded site`);
  return kind;
};

/**
 * What clearing a site pays home in resources, as the contract's site_reward computes it from the guard it started
 * with: a camp half its troops in labor, a rift three times them in Essence, both in game precision. Stragglers pay
 * only XP; a ruin pays its chest.
 */
export const siteReward = (
  kind: SiteKind,
  site: Pick<NativeRows["ExpeditionSite"], "initial_guard_count">,
): { resourceType: ResourcesIds; amount: bigint } | null => {
  if (kind === "Camp") return { resourceType: ResourcesIds.Labor, amount: site.initial_guard_count / 2n };
  if (kind === "Rift") return { resourceType: ResourcesIds.Essence, amount: site.initial_guard_count * 3n };
  return null;
};

/** The expedition map is laid out in bands of `spacing` rows, four per day: surface, then Ethereal I to III. */
const expeditionBand = (rules: ExpeditionRules, coord: { y: number }): number => Math.floor(coord.y / rules.spacing);

/** The depth a tile of the expedition map lies at, as the contract's depth_rules_at reads it. */
export const expeditionDepth = (rules: ExpeditionRules, coord: { y: number }): number =>
  expeditionBand(rules, coord) % 4;

/**
 * When today's expedition ends, where the contract rolls every army and site over; before the season, when it starts.
 */
export const expeditionDayEndsAt = (rules: ExpeditionRules, nowSeconds: number): number =>
  dayOf(rules, nowSeconds)?.end ?? rules.startMainAt;

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

/** Entity IDs carry the home namespace in their upper32bits; old setup homes use their low ID. */
export function entityHomeNamespace(entityId: number | bigint | string): number {
  if (typeof entityId === "number" && !Number.isSafeInteger(entityId)) throw new Error("Unsafe home entity id");
  const value = BigInt(entityId);
  if (value <= 0n || value > 0xffffffffffffffffn) throw new Error("Invalid home entity id");
  return Number(value < 0x100000000n ? value : value >> 32n);
}

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
): { x: number; y: number; alt: boolean } | null => {
  const rules = readExpeditionRules(store, structure.game_id);
  if (rules && isRealmCategory(structure.base.category)) {
    const site = expeditionRealmSite(
      rules,
      entityHomeNamespace(structure.entity_id),
      getBlockTimestamp().currentBlockTimestamp,
    );
    return site ? { x: site.col, y: site.row, alt: false } : null;
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

/** Where a realm stands on today's surface region: the site the contract computes for (home region, day, depth 0). */
export const expeditionRealmSite = (
  rules: ExpeditionRules,
  regionId: number,
  nowSeconds: number,
): { col: number; row: number } | null => {
  const half = Math.floor(rules.spacing / 2);
  const day = seasonDay(rules, nowSeconds);
  if (day === null) return null;
  return {
    col: (regionId - 1) * rules.spacing + half,
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
): { col: number; row: number } | null => {
  const site = expeditionRealmSite(rules, entityHomeNamespace(structure.entity_id), nowSeconds);
  const day = seasonDay(rules, nowSeconds);
  if (!site || day === null) return null;
  const direction = day % 6;
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
        (researchedDepth(store, structure.game_id, structure.entity_id) ?? 0) > 0,
    )
    .flatMap((structure) => {
      const spire = expeditionSpireTile(rules, structure, nowSeconds);
      return spire ? [spire] : [];
    });
};
