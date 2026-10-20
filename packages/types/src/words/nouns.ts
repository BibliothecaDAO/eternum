/**
 * The game's nouns as a player reads them, each read from the game's own table through one function: resources,
 * troops, structures, ranks, guard walls and the three ages. Never a table's raw value ("KnightT2") or an enum's key
 * ("AncientFragment"); unknown is a dash.
 */
import { RealmLevelNames } from "../constants/realmLevels";
import { ResourcesIds } from "../constants/resource-ids";
import { resources } from "../constants/resources";
import { getMinePresentation, StructureTypeToNameMapping } from "../constants/structures";
import { GUARD_SLOT_NAMES, type GuardSlot } from "../constants/troops";
import { StructureType } from "../constants/structure-type";

const UNKNOWN = "—";

export const LORDS = "LORDS";
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

/** The three troops, and a troop with its tier: "Knight T1", "Paladin T3". */
export const TROOP_NAMES = ["Knight", "Crossbowman", "Paladin"] as const;
const troopName = (troop: string, tier: string): string => `${troop} ${tier}`;

const TROOP_RESOURCE = /^(Knight|Crossbowman|Paladin)(T[23])?$/;

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

/** A structure by its kind, a mine by what it yields: "Camp", "Essence Rift", "Hyperstructure". */
export const structureName = (type: StructureType, mineKind?: number): string =>
  type === StructureType.Mine && mineKind !== undefined
    ? getMinePresentation(mineKind).name
    : (StructureTypeToNameMapping[type] ?? UNKNOWN);

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
  minotaur: "Minotaur",
  cyclops: "Cyclops",
} as const;
export const VICTORY = "Victory";
export const ARMY_LOST = "Army lost";
export const GUARD_HOLDS = "Guard holds";
