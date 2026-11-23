/**
 * The game's nouns as a player reads them, each read from the game's own table through one function: resources,
 * troops, structures, ranks, guard walls and the three ages. Never a table's raw value ("KnightT2") or an enum's key
 * ("AncientFragment"); unknown is a dash.
 */
/**
 * The game's nouns as a player reads them, each read from the game's own table through one function: resources,
 * troops, structures, ranks, guard walls and the three ages. Never a table's raw value ("KnightT2") or an enum's key
 * ("AncientFragment"); unknown is a dash.
 */
import { RealmLevelNames } from "../constants/realmLevels";
import { ResourcesIds } from "../constants/resource-ids";
import { resources } from "../constants/resources";
import {
  BuildingType,
  BuildingTypeToString,
  getMinePresentation,
  StructureTypeToNameMapping,
} from "../constants/structures";
import { GUARD_SLOT_NAMES, type GuardSlot } from "../constants/troops";
import { StructureType } from "../constants/structure-type";
import { deepSites } from "../constants/deep-sites";
import { TROOP_TYPES, TroopType } from "../types/common";

const UNKNOWN = "—";

export const LORDS = "LORDS";
export const FRAGMENT = "Fragment";
export const FRAGMENTS = "Fragments";
export const ANCIENT_SEAL = "Ancient Seal";
/** A chest's rarity, common to legendary. */
export const TIER_WORDS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;

const TIER_NUMERALS = ["I", "II", "III", "IV", "V"] as const;
export const tierNumeral = (rank: number): string => {
  const numeral = Number.isInteger(rank) && TIER_NUMERALS[rank - 1];
  if (!numeral) throw new Error(`Invalid rank ${rank}`);
  return numeral;
};
/**
 * Words with ranks in them ("Battle II", "III: +45% damage"): each rank stands as its own part, which a screen draws as
 * the level gem and plain text says as its numeral (rankedText). Every rank a line names is written this way.
 */
export type RankedWords = readonly (string | { rank: number })[];
/** Plain words as ranked words with no rank in them, so either joins into one line. */
export const asRanked = (words: RankedWords | string): RankedWords => (typeof words === "string" ? [words] : words);
/** Words with ranks in them as plain text, each rank as its numeral; untrained, 0. */
export const rankedText = (words: RankedWords | string): string =>
  typeof words === "string"
    ? words
    : words.map((part) => (typeof part === "string" ? part : part.rank === 0 ? "0" : tierNumeral(part.rank))).join("");
/** What a skill point of a rank gives: the point itself, "[III] +1" (owner, 3 November 2026: "I like B"). */
export const skillPointGain = (rank: number): RankedWords => [{ rank }, " +1"];
export const siteUsedLine = (kind: "Shrine" | "Well", amount: string) =>
  kind === "Shrine" ? `Shrine used, +${amount} XP` : `Well used, +${amount} stamina`;
/** What scores: "250 points", "1 point" (formatPoints). Never VP or pts. */
export const POINTS = "points";
export const POINT = "point";

/** A realm's ranks, by level. */
export const REALM_LEVELS = [
  RealmLevelNames.Settlement,
  RealmLevelNames.City,
  RealmLevelNames.Kingdom,
  RealmLevelNames.Empire,
] as const;

/** A realm's rank by its level: "City", never "Level 2". */
export const rankName = (level: number | undefined): string =>
  (level === undefined ? undefined : REALM_LEVELS[level]) ?? UNKNOWN;

/**
 * Each troop type as a player reads it, one and many: "Knight", "Crossbowmen". Keyed by every type the schema allows,
 * so a type it adds does not compile until it has its words.
 */
export const TROOP_WORDS = {
  [TroopType.Knight]: { one: "Knight", many: "Knights" },
  [TroopType.Crossbowman]: { one: "Crossbowman", many: "Crossbowmen" },
  [TroopType.Paladin]: { one: "Paladin", many: "Paladins" },
} as const satisfies Record<TroopType, { one: string; many: string }>;

/** Frontier's troop names; its Scout uses the Paladin category. */
export const FRONTIER_TROOP_NAMES = {
  [TroopType.Knight]: TROOP_WORDS[TroopType.Knight].many,
  [TroopType.Paladin]: "Scouts",
  [TroopType.Crossbowman]: TROOP_WORDS[TroopType.Crossbowman].many,
} satisfies Record<TroopType, string>;

/** Many of a troop type, by its type or its name in the game's tables: "Crossbowmen". Unknown is undefined. */
export const troopPlural = (troop: TroopType | string): string | undefined =>
  (TROOP_WORDS as Record<string, { many: string }>)[troop]?.many;

/** A troop with its tier: "Knight T1", "Paladin T3". */
const troopName = (troop: string, tier: string): string => `${troop} ${tier}`;

const TROOP_RESOURCE = new RegExp(`^(${TROOP_TYPES.join("|")})(T[23])?$`);

/**
 * A resource by its id, as a player reads it: its name in the game's table, a troop with its tier ("Knight T2", where
 * the table says "KnightT2"), LORDS in capitals. Unknown is a dash.
 */
export const resourceName = (id: ResourcesIds | number | undefined): string => {
  if (id === undefined) return UNKNOWN;
  if (id === ResourcesIds.Lords) return LORDS;
  const name = resources.find((resource) => resource.id === id)?.trait;
  if (!name) return UNKNOWN;
  const troop = TROOP_RESOURCE.exec(name);
  return troop ? troopName(troop[1], troop[2] ?? "T1") : name;
};

export type StructureNamingMode = "frontier" | "blitz" | "eternum";

export const structureName = (type: StructureType, mineKind?: number): string =>
  type === StructureType.Mine && mineKind !== undefined
    ? getMinePresentation(mineKind).name
    : (StructureTypeToNameMapping[type] ?? UNKNOWN);

/** The same category names for list headings and discovery choices. */
export const structurePlural = (type: StructureType, mineKind?: number): string => {
  if (type === StructureType.Beasts) return structureName(type, mineKind);
  return `${structureName(type, mineKind)}s`;
};

/** The buildings Frontier raises, by Frontier's names: its barracks trains knights, its hut houses workers. */
const FRONTIER_BUILDINGS = new Map<BuildingType, string>([
  [BuildingType.ResourceWheat, "Farm"],
  [BuildingType.ResourceLabor, "Workshop"],
  [BuildingType.ConscriptionCamp, BuildingTypeToString[BuildingType.ConscriptionCamp]],
  [BuildingType.RationsDepot, BuildingTypeToString[BuildingType.RationsDepot]],
  [BuildingType.SupplyYard, "Supply yard"],
  [BuildingType.ResourceKnightT1, "Barracks"],
  [BuildingType.ScoutsLodge, "Scouts' lodge"],
  [BuildingType.ResourceCrossbowmanT1, "Range"],
  [BuildingType.Storehouse, "Storeroom"],
]);

export const FRONTIER_BUILDING_TYPES: readonly BuildingType[] = [...FRONTIER_BUILDINGS.keys()];

/** Whether Frontier raises this building. */
export const isFrontierBuilding = (category: number): boolean => FRONTIER_BUILDINGS.has(category as BuildingType);

/**
 * A building as its game's player reads it, the one name every list, panel and story uses: Frontier's own name where
 * Frontier raises it ("Barracks"), else the game's table ("Knight T1", "Farm"). Unknown is a dash.
 */
export const buildingName = (category: BuildingType | number, frontier: boolean): string =>
  (frontier ? FRONTIER_BUILDINGS.get(category as BuildingType) : undefined) ??
  BuildingTypeToString[category as BuildingType] ??
  UNKNOWN;

/** A guard slot by its wall, never its internal name: "Castle Wall", not "Gamma". */
export const guardSlotName = (slot: GuardSlot): string => GUARD_SLOT_NAMES[slot] ?? UNKNOWN;

export const LAYER_NAMES = ["Surface", "Veil", "Hollow", "Deep"] as const;
export type MapLayer = 0 | 1 | 2 | 3;
export type LayerPlace = "veil" | "hollow" | "deep";
export const LAYER_PLACES: Readonly<Record<MapLayer, LayerPlace | null>> = Object.freeze({
  0: null,
  1: "veil",
  2: "hollow",
  3: "deep",
});
export const layerName = (depth: number): string => {
  const name = LAYER_NAMES[depth];
  if (name === undefined) throw new Error(`No layer at depth ${depth}`);
  return name;
};
export const ETERNUM_MAP_NAMES = [LAYER_NAMES[0], "Ethereal Layer"] as const;
export const eternumMapName = (alt: boolean): string => ETERNUM_MAP_NAMES[alt ? 1 : 0];

export type BeastModel =
  | "troll"
  | "wyvern"
  | "hydra"
  | "wraith"
  | "cyclops"
  | "ammit"
  | "basilisk"
  | "dark-fey"
  | "balrog"
  | "colossus"
  | "warlock"
  | "banshee"
  | "golem"
  | "kappa"
  | "tarrasque"
  | "lich"
  | "ettin"
  | "kitsune"
  | "minotaur";
export type BeastFamily = "herd" | "band" | "camp" | "rift" | "ruin";
export type BeastIdle = { motion: "breath" | "lift"; speed: number; height: number } | { motion: "hover" };
type BeastLook = { model: BeastModel };
export type BeastRow = {
  name: string;
  family: BeastFamily;
  layer: MapLayer;
  scale: number;
  idle: BeastIdle;
} & BeastLook;
type DeepBeastRow = { name: string; scale: number; idle: BeastIdle } & BeastLook;

const breath = (speed: number, height: number) => ({ motion: "breath", speed, height }) as const;
const lift = (speed: number, height: number) => ({ motion: "lift", speed, height }) as const;
const hover = { motion: "hover" } as const;

export const BEASTS = {
  cyclops: { name: "Cyclops", family: "herd", layer: 0, scale: 1, model: "cyclops", idle: breath(1.5, 0.016) },
  hydra: { name: "Hydra", family: "herd", layer: 1, scale: 1.2, model: "hydra", idle: breath(0.9, 0.018) },
  tarrasque: { name: "Tarrasque", family: "herd", layer: 2, scale: 1, model: "tarrasque", idle: breath(1.2, 0.018) },
  wraith: { name: "Wraith", family: "band", layer: 0, scale: 1, model: "wraith", idle: lift(1.2, 0.028) },
  banshee: { name: "Banshee", family: "band", layer: 1, scale: 1, model: "banshee", idle: lift(1.5, 0.024) },
  lich: { name: "Lich", family: "band", layer: 2, scale: 1, model: "lich", idle: lift(0.9, 0.02) },
  troll: { name: "Troll", family: "camp", layer: 0, scale: 0.85, model: "troll", idle: breath(1.1, 0.014) },
  golem: { name: "Golem", family: "camp", layer: 1, scale: 0.85, model: "golem", idle: breath(0.7, 0.01) },
  ettin: { name: "Ettin", family: "camp", layer: 2, scale: 0.85, model: "ettin", idle: breath(1.3, 0.016) },
  fairy: { name: "Fairy", family: "rift", layer: 0, scale: 0.75, model: "dark-fey", idle: hover },
  kappa: { name: "Kappa", family: "rift", layer: 1, scale: 0.75, model: "kappa", idle: breath(1.6, 0.012) },
  kitsune: { name: "Kitsune", family: "rift", layer: 2, scale: 0.75, model: "kitsune", idle: breath(1.3, 0.012) },
  wyvern: { name: "Wyvern", family: "ruin", layer: 0, scale: 1.35, model: "wyvern", idle: breath(1, 0.018) },
  ammit: { name: "Ammit", family: "ruin", layer: 1, scale: 1.2, model: "ammit", idle: breath(1.4, 0.01) },
  minotaur: { name: "Minotaur", family: "ruin", layer: 2, scale: 1.2, model: "minotaur", idle: breath(1.1, 0.012) },
} as const satisfies Record<string, BeastRow>;

export const DEEP_BEASTS = {
  foundation: { name: "Colossus", scale: 1.3, model: "colossus", idle: breath(0.8, 0.012) },
  core: { name: "Warlock", scale: 1.4, model: "warlock", idle: hover },
  mine: { name: "Balrog", scale: 1.1, model: "balrog", idle: breath(1, 0.016) },
  altar: { name: "Basilisk", scale: 1.2, model: "basilisk", idle: breath(1.3, 0.014) },
} as const satisfies Record<(typeof deepSites)[number]["key"], DeepBeastRow>;

const DEEPLESS_FOURTH_LAYER = 3;
export const DEEPLESS_FOURTH_LAYER_BEASTS = {
  herd: { ...BEASTS.cyclops, layer: 3 },
  band: { ...BEASTS.wraith, layer: 3 },
  camp: { ...BEASTS.troll, layer: 3 },
  rift: { ...BEASTS.fairy, name: "Dark fey", layer: 3 },
  ruin: { ...BEASTS.hydra, family: "ruin", layer: 3, scale: 1.2 },
} as const satisfies Record<BeastFamily, BeastRow>;

export const beastModel = (beast: BeastLook): BeastModel => beast.model;

export const beastOfModel = (model: BeastModel) =>
  [...Object.values<DeepBeastRow>(BEASTS), ...Object.values<DeepBeastRow>(DEEP_BEASTS)].find(
    (beast) => beast.model === model,
  )!;

export const beastOf = (family: BeastFamily, layer: number): BeastRow => {
  const beast = Object.values<BeastRow>(BEASTS).find((each) => each.family === family && each.layer === layer);
  if (!beast) throw new Error(`No ${family} beast on layer ${layer}`);
  return beast;
};

export const siteBeastOf = (family: BeastFamily, depth: number, gameHasDeep: boolean): BeastRow =>
  !gameHasDeep && depth === DEEPLESS_FOURTH_LAYER ? DEEPLESS_FOURTH_LAYER_BEASTS[family] : beastOf(family, depth);

export const beastsOfFamily = (family: BeastFamily): BeastRow[] =>
  Object.values<BeastRow>(BEASTS)
    .filter((beast) => beast.family === family)
    .sort((a, b) => a.layer - b.layer);

/** Frontier creatures are the encounter itself; a rift or ruin retains its landmark name. */
export const frontierSiteName = (type: StructureType, beast?: { name: string }): string =>
  (type === StructureType.Camp || type === StructureType.Beasts) && beast ? beast.name : structureName(type);

export const guardedSiteKind = (type: StructureType, beast?: { name: string }): string =>
  beast && (type === StructureType.Rift || type === StructureType.Ruin)
    ? `${beast.name} ${structureName(type)}`
    : frontierSiteName(type, beast);

export const VICTORY = "Victory";
export const ARMY_LOST = "Army lost";
export const GUARD_HOLDS = "Guard holds";
