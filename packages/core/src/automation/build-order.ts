import {
  BuildingType,
  BuildingTypeToString,
  getBuildingFromResource,
  getResourceTiers,
  REALM_LEVELS,
  type ResourcesIds,
  TroopTier,
} from "@bibliothecadao/types";

/**
 * A build order, as a player makes, saves and shares it: a name and its steps in order, each from a rank (a realm
 * level) up. Shared as JSON, the one form players copy, paste and save:
 *
 *   { "name": "Coal rush", "steps": [{ "rank": "Settlement", "goal": "farm", "count": 2 }, { "rank": "City", "goal": "levelUp" }] }
 *
 * A step is met once the realm has at least `count` of its goal. Level up needs no step: the realm levels up first
 * whenever it can, unless the order places a level up at that rank, which then waits its turn. A worker hut needs no
 * step either: it comes when the next step needs the room.
 */

/**
 * Every building Blitz raises, as its construction panel lists them: a building for each of Blitz's food, materials
 * (three lines over three tiers), transport and troops (three troops over three tiers) in the game's own resource
 * catalog, and the worker hut.
 */
const readBlitzResources = () => {
  const tiers = getResourceTiers(true);
  if (!("materials" in tiers)) throw new Error("Blitz's resource catalog has no materials");
  return tiers;
};
const BLITZ_RESOURCES = readBlitzResources();
const BLITZ_PRODUCERS = new Map<BuildingType, ResourcesIds>(
  [
    ...BLITZ_RESOURCES.food,
    ...BLITZ_RESOURCES.materials,
    ...BLITZ_RESOURCES.transport,
    ...BLITZ_RESOURCES.military,
  ].map((resource) => [getBuildingFromResource(resource), resource]),
);
export const BLITZ_BUILDINGS: readonly BuildingType[] = [...BLITZ_PRODUCERS.keys(), BuildingType.WorkersHut];

/** What a Blitz building makes; the worker hut makes none. */
export const blitzBuildingResource = (building: BuildingType): ResourcesIds | undefined =>
  BLITZ_PRODUCERS.get(building);

/**
 * What a goal asks for: a building; the barracks or the field armies of the troop the realm's biome favours, at a tier
 * (an army deployed once a full one is on hand); or the realm's next level.
 */
type BuildOrderTarget =
  | { kind: "building"; building: BuildingType }
  | { kind: "barracks"; tier: TroopTier }
  | { kind: "army"; tier: TroopTier }
  | { kind: "levelUp" };

/** The words players already use for three buildings; every other building is named for what it makes. */
const SPOKEN_BUILDINGS: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceWheat]: "farm",
  [BuildingType.ResourceDonkey]: "market",
  [BuildingType.WorkersHut]: "hut",
};

/** A building's goal word: "farm", "coldIron", "knightT2". */
const buildingGoal = (building: BuildingType): string => {
  const name = BuildingType[building].replace(/^Resource/, "");
  return SPOKEN_BUILDINGS[building] ?? name[0].toLowerCase() + name.slice(1);
};

/** The goal of the building that makes a resource. */
const producerGoal = (resource: ResourcesIds): string => buildingGoal(getBuildingFromResource(resource));

/** Blitz's troops tier by tier, each tier in the catalog's troop order: its buildings are named "…T1" to "…T3". */
const troopsByTier = (): ResourcesIds[] => {
  const tierOf = (resource: ResourcesIds) => BuildingType[getBuildingFromResource(resource)].slice(-1);
  return [...BLITZ_RESOURCES.military].sort((left, right) => tierOf(left).localeCompare(tierOf(right)));
};

/** A biome troop's goal at a tier: "army" for T1, as orders already say it, then "armyT2", "armyT3". */
const tierGoal = (kind: "barracks" | "army", tier: TroopTier): string => (tier === TroopTier.T1 ? kind : kind + tier);
const TIERS = [TroopTier.T1, TroopTier.T2, TroopTier.T3];

const GOAL_TARGETS = new Map<string, BuildOrderTarget>([
  ...BLITZ_BUILDINGS.map((building): [string, BuildOrderTarget] => [
    buildingGoal(building),
    { kind: "building", building },
  ]),
  ...TIERS.map((tier): [string, BuildOrderTarget] => [tierGoal("barracks", tier), { kind: "barracks", tier }]),
  ...TIERS.map((tier): [string, BuildOrderTarget] => [tierGoal("army", tier), { kind: "army", tier }]),
  ["levelUp", { kind: "levelUp" }],
]);

/** Every goal a step can name, one for each building Blitz raises, so the maker, the reader and the game share one list. */
export const BUILD_ORDER_GOALS: readonly string[] = [...GOAL_TARGETS.keys()];
export type BuildOrderGoal = string;

/**
 * A group of goals as the maker offers them. With `heads`, its goals stand in a table, as the construction panel draws
 * Blitz's troops: a column each head, a tier a row, row by row.
 */
export interface BuildOrderGoalGroup {
  label: string;
  goals: readonly BuildOrderGoal[];
  heads?: readonly string[];
}

/** A troop's name, as its T1 building is named without its tier: "Knight". */
const troopName = (resource: ResourcesIds): string =>
  BuildingTypeToString[getBuildingFromResource(resource)].replace(/ T\d$/, "");

/**
 * The goals as the maker offers them, each once: the realm's own, Blitz's materials in their tiers (three to a tier),
 * its troops by tier under each troop, and the barracks and armies of the troop the realm's biome favours by tier.
 */
export const BUILD_ORDER_GOAL_GROUPS: readonly BuildOrderGoalGroup[] = [
  {
    label: "Realm",
    goals: ["levelUp", ...[...BLITZ_RESOURCES.food, ...BLITZ_RESOURCES.transport].map(producerGoal), "hut"],
  },
  { label: "Resources", goals: BLITZ_RESOURCES.materials.map(producerGoal) },
  {
    label: "Troops",
    heads: troopsByTier().slice(0, 3).map(troopName),
    goals: troopsByTier().map(producerGoal),
  },
  {
    label: "Your biome's troop",
    heads: ["Barracks", "Army"],
    goals: TIERS.flatMap((tier) => [tierGoal("barracks", tier), tierGoal("army", tier)]),
  },
];

/** What a goal asks for; a word that is not a goal is loud, since every step was read through `isGoal`. */
export const buildOrderTarget = (goal: BuildOrderGoal): BuildOrderTarget => {
  const target = GOAL_TARGETS.get(goal);
  if (!target) throw new Error(`“${goal}” is not a build order goal`);
  return target;
};

/** A goal as players read it: the building's own name, "Barracks T2", "Army", "Level up". */
export const buildOrderGoalName = (goal: BuildOrderGoal): string => {
  const target = buildOrderTarget(goal);
  if (target.kind === "building") return BuildingTypeToString[target.building];
  if (target.kind === "levelUp") return "Level up";
  const name = target.kind === "army" ? "Army" : "Barracks";
  return target.tier === TroopTier.T1 ? name : `${name} ${target.tier}`;
};

/** One step: from `rank` (a realm level) up, have at least `count` of `goal` (a level up counts 1). */
export interface BuildOrderStep {
  rank: number;
  goal: BuildOrderGoal;
  count: number;
}

export interface BuildOrder {
  name: string;
  steps: BuildOrderStep[];
}

/** A player's saved orders and the one their Build order panel follows (none: the default). */
export interface BuildOrderBook {
  orders: { id: string; order: BuildOrder }[];
  active: string | null;
}

type Read<T> = { ok: T } | { error: string };

export const BUILD_ORDER_LIMITS = { name: 40, steps: 60, count: 99, orders: 20, id: 40 } as const;
const LAST_RANK = REALM_LEVELS.length - 1;
const UNREADABLE_BOOK = "Saved build orders could not be read.";

/** An order's JSON value: each step's rank by name, a level up with no count. */
const buildOrderValue = (order: BuildOrder) => ({
  name: order.name,
  steps: order.steps.map(({ rank, goal, count }) =>
    goal === "levelUp" ? { rank: REALM_LEVELS[rank], goal } : { rank: REALM_LEVELS[rank], goal, count },
  ),
});

/** An order as the JSON a player copies: one step a line, so it reads as the list it is. */
export const buildOrderJson = (order: BuildOrder): string => {
  const { name, steps } = buildOrderValue(order);
  const lines = steps.map((step) => `    ${JSON.stringify(step)}`).join(",\n");
  return `{\n  "name": ${JSON.stringify(name)},\n  "steps": [\n${lines}\n  ]\n}`;
};

/** A book as it is saved: each order in its shared form. */
export const buildOrderBookValue = (book: BuildOrderBook) => ({
  orders: book.orders.map(({ id, order }) => ({ id, order: buildOrderValue(order) })),
  active: book.active,
});

/** Reads an order a player pasted, or says in their words why it is not one. */
export const readBuildOrderText = (text: string): Read<BuildOrder> => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: "This isn't JSON. Use Copy JSON." };
  }
  return readBuildOrder(value);
};

/** Reads an order's JSON value: its name, then each step, checked in turn; the first that cannot be read is named. */
export const readBuildOrder = (value: unknown): Read<BuildOrder> => {
  if (!isRecord(value) || !Array.isArray(value.steps))
    return { error: 'A build order is { "name": …, "steps": [ … ] }.' };
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (name.length === 0 || name.length > BUILD_ORDER_LIMITS.name)
    return { error: `A name is 1 to ${BUILD_ORDER_LIMITS.name} characters.` };
  if (value.steps.length === 0 || value.steps.length > BUILD_ORDER_LIMITS.steps)
    return { error: `An order has 1 to ${BUILD_ORDER_LIMITS.steps} steps.` };
  const steps: BuildOrderStep[] = [];
  for (const [index, raw] of value.steps.entries()) {
    const step = readStep(raw, index + 1, steps);
    if ("error" in step) return step;
    steps.push(step.ok);
  }
  return { ok: { name, steps } };
};

/** One step, in the light of the steps before it: ranks only rise, and a rank holds one level up, Empire none. */
const readStep = (raw: unknown, number: number, before: BuildOrderStep[]): Read<BuildOrderStep> => {
  const refuse = (why: string) => ({ error: `Step ${number}: ${why}` });
  if (!isRecord(raw)) return refuse('a step is { "rank": "City", "goal": "farm", "count": 4 }.');
  const rank = rankOf(raw.rank);
  if (rank === -1) return refuse(`“${String(raw.rank)}” is not a rank: ${REALM_LEVELS.join(", ")}.`);
  if (!isGoal(raw.goal)) return refuse(`“${String(raw.goal)}” is not a goal: ${BUILD_ORDER_GOALS.join(", ")}.`);
  const previous = before.at(-1);
  if (previous && rank < previous.rank)
    return refuse(
      `it is at ${REALM_LEVELS[rank]}, after a ${REALM_LEVELS[previous.rank]} step: steps go rank by rank.`,
    );
  if (raw.goal === "levelUp") return readLevelUp(rank, before, refuse);
  const count = raw.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > BUILD_ORDER_LIMITS.count)
    return refuse(`a count is a whole number from 1 to ${BUILD_ORDER_LIMITS.count}.`);
  return { ok: { rank, goal: raw.goal, count } };
};

const readLevelUp = (
  rank: number,
  before: BuildOrderStep[],
  refuse: (why: string) => { error: string },
): Read<BuildOrderStep> => {
  if (rank === LAST_RANK) return refuse(`${REALM_LEVELS[LAST_RANK]} is the last rank: it has no level up.`);
  if (before.some((step) => step.goal === "levelUp" && step.rank === rank))
    return refuse(`${REALM_LEVELS[rank]} already levels up.`);
  return { ok: { rank, goal: "levelUp", count: 1 } };
};

/** Reads a saved book of orders: at most 20, each read as a pasted one, its active order one of them or none. */
export const readBuildOrderBook = (value: unknown): Read<BuildOrderBook> => {
  if (!isRecord(value) || !Array.isArray(value.orders)) return { error: UNREADABLE_BOOK };
  if (value.orders.length > BUILD_ORDER_LIMITS.orders)
    return { error: `You can keep ${BUILD_ORDER_LIMITS.orders} build orders.` };
  const orders: BuildOrderBook["orders"] = [];
  for (const entry of value.orders) {
    if (!isRecord(entry) || !isBookId(entry.id) || orders.some(({ id }) => id === entry.id))
      return { error: UNREADABLE_BOOK };
    const order = readBuildOrder(entry.order);
    if ("error" in order) return order;
    orders.push({ id: entry.id, order: order.ok });
  }
  const active = value.active ?? null;
  if (active === null) return { ok: { orders, active } };
  if (typeof active !== "string" || !orders.some(({ id }) => id === active)) return { error: UNREADABLE_BOOK };
  return { ok: { orders, active } };
};

/** The order a player's book makes active, or the default. */
export const activeBuildOrder = (book: BuildOrderBook | null): BuildOrder =>
  book?.orders.find(({ id }) => id === book.active)?.order ?? DEFAULT_BUILD_ORDER;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isGoal = (word: unknown): word is BuildOrderGoal =>
  typeof word === "string" && (BUILD_ORDER_GOALS as readonly string[]).includes(word);
const isBookId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= BUILD_ORDER_LIMITS.id;
const rankOf = (word: unknown): number =>
  typeof word === "string" ? REALM_LEVELS.findIndex((rank) => rank.toLowerCase() === word.toLowerCase()) : -1;

/**
 * The owner's order, the default: farms first at each rank, then wood, coal and copper raised together, then the
 * realm's T1 barracks; at City, its first army of those troops deployed once automation has trained a full one.
 */
const DEFAULT_STEPS: [rank: string, goal: BuildOrderGoal, count: number][] = [
  ["Settlement", "farm", 2],
  ["City", "farm", 4],
  ["City", "wood", 1],
  ["City", "coal", 1],
  ["City", "copper", 1],
  ["City", "wood", 2],
  ["City", "coal", 2],
  ["City", "copper", 2],
  ["City", "barracks", 1],
  ["City", "army", 1],
  ["Kingdom", "farm", 8],
  ["Kingdom", "wood", 3],
  ["Kingdom", "coal", 3],
  ["Kingdom", "copper", 3],
  ["Kingdom", "wood", 4],
  ["Kingdom", "coal", 4],
  ["Kingdom", "copper", 4],
  ["Kingdom", "barracks", 3],
  ["Empire", "farm", 12],
  ["Empire", "wood", 5],
  ["Empire", "coal", 5],
  ["Empire", "copper", 5],
  ["Empire", "wood", 6],
  ["Empire", "coal", 6],
  ["Empire", "copper", 6],
  ["Empire", "barracks", 5],
];

const readDefaultOrder = (): BuildOrder => {
  const read = readBuildOrder({
    name: "Default",
    steps: DEFAULT_STEPS.map(([rank, goal, count]) => ({ rank, goal, count })),
  });
  if ("error" in read) throw new Error(`The default build order does not read: ${read.error}`);
  return read.ok;
};

export const DEFAULT_BUILD_ORDER: BuildOrder = readDefaultOrder();
