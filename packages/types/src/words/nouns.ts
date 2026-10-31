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
import { TROOP_TYPES, TroopType } from "../types/common";

const UNKNOWN = "—";

export const LORDS = "LORDS";
export const XP = "XP";
/** A chest's rarity, common to legendary. */
export const TIER_WORDS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
/**
 * A rank a player levels, by its numeral, I to V: an attribute's tier, a skill point's rank, a research tier. Every
 * surface names ranks this way: the army panel, its level-ups, research, the Feed and the day log.
 */
const TIER_NUMERALS = ["I", "II", "III", "IV", "V"] as const;
export const tierNumeral = (rank: number): string => {
  const numeral = Number.isInteger(rank) && TIER_NUMERALS[rank - 1];
  if (!numeral) throw new Error(`Invalid rank ${rank}`);
  return numeral;
};
export const skillPointName = (rank: number): string => `${tierNumeral(rank)} skill point`;
/** Gains and purchases in both the history Log and Frontier's Today sheet. */
export const xpGainedLine = (line: string, amount: string) => `${line}, +${amount} ${XP}`;
export const siteUsedLine = (kind: "Shrine" | "Well", amount: string) =>
  kind === "Shrine" ? xpGainedLine("Shrine used", amount) : `Well used, +${amount} stamina`;
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

export type StructureNamingMode = "frontier" | "blitz" | "eternum" | "duel";

/** A structure in its game: Frontier replaces the camp category with a Troll; other modes keep their own names. */
export const structureName = (type: StructureType, mineKind?: number, mode?: StructureNamingMode): string =>
  mode === "frontier" && type === StructureType.Camp
    ? BEAST_NAMES.troll
    : type === StructureType.Mine && mineKind !== undefined
      ? getMinePresentation(mineKind).name
      : (StructureTypeToNameMapping[type] ?? UNKNOWN);

/** The same category names for list headings and discovery choices. */
export const structurePlural = (type: StructureType, mineKind?: number, mode?: StructureNamingMode): string => {
  if (type === StructureType.Beasts) return structureName(type, mineKind, mode);
  if (type === StructureType.BitcoinMine) return "Bitcoin mines";
  return `${structureName(type, mineKind, mode)}s`;
};

/** The buildings Frontier raises, by Frontier's names: its barracks trains knights, its hut houses workers. */
const FRONTIER_BUILDINGS: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceWheat]: "Farm",
  [BuildingType.ResourceLabor]: "Workshop",
  [BuildingType.ResourceKnightT1]: "Barracks",
  [BuildingType.WorkersHut]: "Hut",
  [BuildingType.WarHall]: "War hall",
  [BuildingType.SupplyYard]: "Supply yard",
  [BuildingType.ScoutsLodge]: "Scouts' lodge",
  [BuildingType.Hearth]: "Hearth",
};

/** Whether Frontier raises this building. */
export const isFrontierBuilding = (category: number): boolean => category in FRONTIER_BUILDINGS;

/**
 * A building as its game's player reads it, the one name every list, panel and story uses: Frontier's own name where
 * Frontier raises it ("Barracks"), else the game's table ("Knight T1", "Farm"). Unknown is a dash.
 */
export const buildingName = (category: BuildingType | number, frontier: boolean): string =>
  (frontier ? FRONTIER_BUILDINGS[category as BuildingType] : undefined) ??
  BuildingTypeToString[category as BuildingType] ??
  UNKNOWN;

/** A guard slot by its wall, never its internal name: "Castle Wall", not "Gamma". */
export const guardSlotName = (slot: GuardSlot): string => GUARD_SLOT_NAMES[slot] ?? UNKNOWN;

/** Each game as its age of the lore. */
export const AGES = {
  blitz: { game: "Blitz", age: "Age I" },
  frontier: { game: "Frontier", age: "Age II" },
  eternum: { game: "Eternum", age: "Age III" },
} as const;
export const ageLine = (game: keyof typeof AGES): string => `${AGES[game].game} · ${AGES[game].age}`;

export const BEAST_NAMES = {
  troll: "Troll",
  wyvern: "Wyvern",
  hydra: "Hydra",
  wraith: "Wraith",
  cyclops: "Cyclops",
  ammit: "Ammit",
  basilisk: "Basilisk",
  "dark-fey": "Dark fey",
} as const;
type FrontierGuard = { beast: keyof typeof BEAST_NAMES; scale: number };
/** Who guards a ruin, by depth from the surface to Ethereal III, and at what size its model stands. */
export const FALLEN_REALM_DEPTHS: readonly FrontierGuard[] = [
  { beast: "ammit", scale: 1.2 },
  { beast: "basilisk", scale: 1.2 },
  { beast: "wyvern", scale: 1.35 },
  { beast: "hydra", scale: 1.7 },
];
/** A roaming band of beasts: the weaker band or the stronger, at every depth. */
export const ROAMING_BEASTS = {
  lowly: { beast: "cyclops", scale: 1 },
  stronger: { beast: "wraith", scale: 1 },
} as const satisfies Record<string, FrontierGuard>;
/** A camp's and a rift's guard, the same at every depth. */
export const SITE_GUARDS = {
  camp: { beast: "troll", scale: 0.85 },
  rift: { beast: "dark-fey", scale: 0.75 },
} as const satisfies Record<string, FrontierGuard>;
/** Frontier creatures are the encounter itself; a rift or ruin retains its landmark name. */
export const frontierSiteName = (type: StructureType, beast?: { name: string }): string =>
  (type === StructureType.Camp || type === StructureType.Beasts) && beast
    ? beast.name
    : structureName(type, undefined, "frontier");

/** What a player earns with a ruin's clear, as another player's line and their own say it. */
export const CHEST_EARNED = "chest earned";
export const VICTORY = "Victory";
export const ARMY_LOST = "Army lost";
export const GUARD_HOLDS = "Guard holds";
