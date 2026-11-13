import { currentArmy, deepCenter } from "./deep";
import { entityHomeNamespace } from "./entity-home";
import { MAX_U32, ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { nativeRuleConstants as rule, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { getNeighborHexes, StructureType } from "@bibliothecadao/types";
import { getBlockTimestamp } from "./timestamp";
import { dayOf } from "./days";
import { previewSiteClearXp, previewSiteReward } from "../../../../contracts/l3/world-native/schema/site-previews.gen";

import { entityMapPosition } from "./tile";

export * from "./days";
export * from "./home-claim";

export type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

type ExpeditionRuleModel = "SliceRules" | "GameRegistry" | "SettlementRules";
type ExpeditionRuleReader = (model: ExpeditionRuleModel) => Record<string, unknown> | undefined;

/** One reader for the season's calendar and grid, from the native store or Herald's fold. */
export const readExpeditionRules = (
  source: Pick<NativeFactStore, "get"> | ExpeditionRuleReader,
  gameId: number,
): { dayUnitSeconds: number; spacing: number; startMainAt: number; endAt: number; seed: bigint } | null => {
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
    endAt: Number(game.end_at),
    seed: BigInt(game.seed as bigint | string),
  };
};

/** The season day an expedition timestamp falls in: its index keys the day's map region and every per-day fact. */
export const seasonDay = (rules: ExpeditionRules, timestamp: number): number | null =>
  dayOf(rules, timestamp)?.index ?? null;

/** A guarded Frontier site's kind is its structure category. */
export type SiteKind = "Camp" | "Rift" | "Ruin" | "Beasts";
const SITE_KINDS = new Map<number, SiteKind>([
  [StructureType.Camp, "Camp"],
  [StructureType.Rift, "Rift"],
  [StructureType.Ruin, "Ruin"],
  [StructureType.Beasts, "Beasts"],
]);
/** Whether a structure category is a guarded Frontier site. */
export const isGuardedSite = (category: number): boolean => SITE_KINDS.has(category);
export const siteKindOf = (category: number): SiteKind => {
  const kind = SITE_KINDS.get(category);
  if (!kind) throw new Error(`Structure category ${category} is not a guarded site`);
  return kind;
};

/** A standing site's reward from the generated Cairo formula; a clear's actual credit lives in its receipt. */
export const siteReward = (
  store: Pick<NativeFactStore, "require">,
  site: Pick<
    NativeRows["ExpeditionSite"],
    "category" | "beast_kind" | "initial_guard_count" | "clear" | "game_id" | "row"
  >,
): { resourceType: ResourcesIds; amount: bigint } | null =>
  site.clear
    ? null
    : previewSiteReward(site.category, site.beast_kind, site.initial_guard_count, siteDepth(store, site));

/** The contract's integer XP formula, shared by the preview, receipt and local replay. */
export const siteClearXp = (
  store: Pick<NativeFactStore, "require">,
  site: Pick<NativeRows["ExpeditionSite"], "beast_kind" | "initial_guard_count" | "game_id" | "row">,
): number => previewSiteClearXp(site.initial_guard_count, siteDepth(store, site), site.beast_kind);

const siteDepth = (
  store: Pick<NativeFactStore, "require">,
  site: Pick<NativeRows["ExpeditionSite"], "game_id" | "row">,
): number => {
  const { spacing } = store.require("SettlementRules", { game_id: site.game_id });
  if (spacing <= 0) throw new Error("Site rewards require positive expedition spacing");
  return Math.floor(site.row / spacing) % 4;
};

/** The expedition map is laid out in bands of `spacing` rows, four per day: surface, then Ethereal I to III. */
const expeditionBand = (rules: ExpeditionRules, coord: { y: number }): number => Math.floor(coord.y / rules.spacing);

/** The depth a tile of the expedition map lies at, as the contract's depth_rules_at reads it. */
export const expeditionDepth = (rules: ExpeditionRules, coord: { y: number }): number =>
  expeditionBand(rules, coord) % 4;

/** An Ethereal layer, I to III: a Frontier depth below the day's surface. */
export type EtherealLayer = 1 | 2 | 3;

/**
 * The Ethereal layer an army stands in, by the same depth the terrain and the spire read; none on the day's surface or
 * in a game without expeditions.
 */
export const armyEtherealLayer = (
  store: Pick<NativeFactStore, "get" | "entityOccupancy">,
  gameId: number,
  explorerId: number | bigint,
): EtherealLayer | undefined => {
  const rules = readExpeditionRules(store, gameId);
  const layer = rules ? expeditionDepth(rules, entityMapPosition(store, gameId, explorerId)) : 0;
  return layer === 0 ? undefined : (layer as EtherealLayer);
};

/**
 * Whether a tile lies in the Ethereal layer, which the terrain draws with its ethereal surface: Eternum's other map
 * layer, or a Frontier depth below the day's surface (Ethereal I to III, a region down the same map).
 */
export const isEtherealTile = (rules: ExpeditionRules | null, hex: { row: number; alt: boolean }): boolean =>
  hex.alt || (rules !== null && expeditionDepth(rules, { y: hex.row }) > 0);

/**
 * Whether an army going from one tile to another passes through a spire instead of walking: onto the other map layer
 * (a spire's travel), or into another expedition region (a spire's portal to the Ethereal layer, which the contract
 * places a region down the same map). Regions lie a spacing apart with void between, so no walk joins two.
 */
export const isArmyCrossing = (
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  from: { col: number; row: number; alt: boolean },
  to: { col: number; row: number; alt: boolean },
): boolean => {
  if (from.alt !== to.alt) return true;
  const rules = readExpeditionRules(store, gameId);
  if (!rules) return false;
  const region = ({ col, row }: { col: number; row: number }) =>
    `${Math.floor(col / rules.spacing)}:${expeditionBand(rules, { y: row })}`;
  return region(from) !== region(to);
};

/**
 * When today's expedition ends, where the contract rolls every army and site over; before the season, when it starts.
 */
export const expeditionDayEndsAt = (rules: ExpeditionRules, nowSeconds: number): number =>
  dayOf(rules, nowSeconds)?.end ?? (nowSeconds < rules.startMainAt ? rules.startMainAt : Infinity);

/** An army lives for its recorded expedition day, including on the fixed shared Deep. */
export const isCurrentExpeditionArmy = (rules: ExpeditionRules, day: bigint | number, nowSeconds: number): boolean => {
  const today = seasonDay(rules, nowSeconds);
  return today !== null && BigInt(day) === BigInt(today);
};

/** Every surface uses the recorded day, never the shared map coordinate, to decide whether an army still lives. */
export function isArmyCurrent(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  explorerId: bigint,
  timestamp?: number,
): boolean {
  const slice = store.get("SliceRules", { game_id: gameId });
  if (!slice || slice.day_unit_seconds === 0) return true;
  const rules = readExpeditionRules(store, gameId)!;
  const army = store.get("ArmyDay", { game_id: gameId, explorer_id: explorerId });
  if (!army) throw new Error(`Missing expedition day for army ${gameId}:${explorerId}`);
  return isCurrentExpeditionArmy(rules, army.day, timestamp ?? getBlockTimestamp().currentDefaultTick);
}

/** Personal expedition sites retain the day encoded by their map region. */
export const isCurrentExpeditionRegion = (
  rules: ExpeditionRules,
  coord: { x: number; y: number; alt: boolean },
  nowSeconds: number,
): boolean => !coord.alt && isCurrentExpeditionArmy(rules, Math.floor(expeditionBand(rules, coord) / 4), nowSeconds);

/**
 * A structure's living field armies: troops left and, in a game with expeditions, assigned to today. An army
 * from an earlier day is dead by rule: every command refuses it, and the contract destroys it before checking the army
 * cap when the realm next musters. So it never counts toward that cap or shows as the realm's army, even while its row
 * is still a fact. Today is judged at the execution floor, the time the next command will run at, unless a caller that
 * follows the clock passes the floor it read.
 */
export const liveHomeArmies = (
  store: Pick<NativeFactStore, "get" | "require" | "armiesAtHome" | "entityOccupancy">,
  structureId: number,
  gameId: number,
  floorSeconds?: number,
): NativeRows["ExplorerTroops"][] => {
  const armies = [...store.armiesAtHome(gameId, structureId)]
    .map((army) => currentArmy(store, army, floorSeconds))
    .filter((army) => army.troops.count > 0n);
  return armies.filter((army) => isArmyCurrent(store, gameId, army.explorer_id, floorSeconds));
};

/**
 * Where a look into a found spire goes: the layer below it, at its realm's army there today, else straight below the
 * spire, near where an army beside it lands (enter_depth takes the nearest free tile under it).
 */
export const spireEtherealView = (
  store: Pick<NativeFactStore, "get" | "require" | "armiesAtHome" | "entityOccupancy">,
  spire: FoundSpire,
): { col: number; row: number } => {
  const gameId = spire.realm.game_id;
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error("A spire stands only in an expedition game");
  const below = spire.depth + 1;
  if (below > 3) throw new Error("The Deep has no spire below it");
  const there = liveHomeArmies(store, Number(spire.realm.entity_id), gameId)
    .map((army) => entityMapPosition(store, gameId, army.explorer_id))
    .find((at) => expeditionDepth(rules, at) === below);
  return there ? { col: there.x, row: there.y } : viewInLayer(rules, spire, below as EtherealLayer);
};

/**
 * The same spot of a region in another of its layers, the day's surface (0) or an Ethereal layer: the contract lays each
 * layer a region down the same map, column kept, so a view switches layer by moving the camera that many regions.
 */
export const viewInLayer = (
  rules: ExpeditionRules,
  at: { col: number; row: number },
  layer: 0 | EtherealLayer,
): { col: number; row: number } =>
  layer === 3
    ? deepCenter(rules.spacing)
    : {
        col: at.col,
        row: at.row + (layer - expeditionDepth(rules, { y: at.row })) * rules.spacing,
      };

export { entityHomeNamespace } from "./entity-home";

/** A player's expedition home is a realm: its armies muster each day, and other structures are only met on the way. */
export const isRealmCategory = (category: number): boolean => category === StructureType.Realm;

/** Frontier realms occupy no stored tile; their daily sites follow the expedition rules. */
export const isExpeditionRealm = (
  store: Pick<NativeFactStore, "get" | "require">,
  structure: NativeRows["Structure"],
): boolean => isRealmCategory(structure.base.category) && readExpeditionRules(store, structure.game_id) !== null;

/** Frontier homes follow the calendar; every standing fixed structure occupies its tile. */
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

/** Whether an army stands where enter_depth takes it: on its realm's spire or beside it. */
export const isAtExpeditionSpire = (spire: { col: number; row: number }, coord: { x: number; y: number }): boolean =>
  (spire.col === coord.x && spire.row === coord.y) ||
  getNeighborHexes(spire.col, spire.row).some((hex) => hex.col === coord.x && hex.row === coord.y);

/** A spire a realm found today on a layer (ExpeditionSpire): its tile, the layer it stands on, and its realm. */
export type FoundSpire = { col: number; row: number; depth: number; realm: NativeRows["Structure"] };

/**
 * A realm's spire record on a layer today: the reveals its armies made there with Spire lore, and where the spire stands
 * once found. Undefined before the first such reveal, outside an expedition game or outside the season.
 */
export const realmSpireToday = (
  store: Pick<NativeFactStore, "get" | "require">,
  realm: NativeRows["Structure"],
  depth: number,
  nowSeconds: number,
): NativeRows["ExpeditionSpire"] | undefined => {
  const rules = readExpeditionRules(store, realm.game_id);
  const today = rules ? seasonDay(rules, nowSeconds) : null;
  if (today === null) return undefined;
  return store.get("ExpeditionSpire", {
    game_id: realm.game_id,
    structure_id: realm.entity_id,
    epoch: BigInt(today),
    depth,
  });
};

/**
 * The odds, out of 100, that a realm's next reveal on a layer finds its spire: one SPIRE_REVEAL_LIMIT-th more for each
 * reveal already made, so the last of them finds it. Null once it is found.
 */
export const nextSpireOdds = (record: NativeRows["ExpeditionSpire"] | undefined): number | null => {
  if (record?.location) return null;
  const made = record?.reveals ?? 0;
  return Math.round((Math.min(made + 1, rule.SPIRE_REVEAL_LIMIT) * 100) / rule.SPIRE_REVEAL_LIMIT);
};

const foundSpire = (
  store: Pick<NativeFactStore, "get" | "require">,
  realm: NativeRows["Structure"],
  depth: number,
  nowSeconds: number,
): FoundSpire | null => {
  const location = realmSpireToday(store, realm, depth, nowSeconds)?.location;
  return location ? { col: location.x, row: location.y, depth, realm } : null;
};

/** A living army's realm's spire, found today on the layer the army stands on; null otherwise. */
export const armyRealmSpire = (
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  gameId: number,
  explorerId: number | bigint,
  nowSeconds: number,
): FoundSpire | null => {
  const rules = readExpeditionRules(store, gameId);
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: explorerId });
  const realm =
    rules && army && army.troops.count > 0n ? store.get("Structure", { game_id: gameId, entity_id: army.owner }) : null;
  const tile = realm ? store.entityOccupancy(gameId, explorerId) : undefined;
  return realm && rules && tile ? foundSpire(store, realm, expeditionDepth(rules, { y: tile.row }), nowSeconds) : null;
};

/** A living army's realm's spire while the army stands where enter_depth takes it (on it or beside it); null elsewhere. */
export const armyAtItsSpire = (
  store: Pick<NativeFactStore, "get" | "require" | "entityOccupancy">,
  gameId: number,
  explorerId: number | bigint,
  nowSeconds: number,
): FoundSpire | null => {
  const spire = armyRealmSpire(store, gameId, explorerId, nowSeconds);
  const tile = spire && store.entityOccupancy(gameId, explorerId);
  return spire && tile && isAtExpeditionSpire(spire, { x: tile.col, y: tile.row }) ? spire : null;
};

/** Every spire found today that the store knows of, on every layer, with its realm. */
export const expeditionSpires = (
  store: Pick<NativeFactStore, "get" | "require" | "inGame">,
  gameId: number,
  nowSeconds: number,
): FoundSpire[] => {
  const rules = readExpeditionRules(store, gameId);
  const today = rules ? seasonDay(rules, nowSeconds) : null;
  if (today === null) return [];
  return [...store.inGame("ExpeditionSpire", gameId)].flatMap((record) => {
    const realm = store.get("Structure", { game_id: gameId, entity_id: record.structure_id });
    return record.epoch === BigInt(today) && record.location && realm
      ? [{ col: record.location.x, row: record.location.y, depth: record.depth, realm }]
      : [];
  });
};
