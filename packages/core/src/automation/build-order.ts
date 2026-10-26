import { REALM_LEVELS } from "@bibliothecadao/types";

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
 * What a step asks for: buildings, "barracks" being the realm's best T1 troop building for its biome; "army", the
 * realm's field armies of that troop, deployed once a full army is on hand; "levelUp", the realm's next level.
 */
export const BUILD_ORDER_GOALS = ["farm", "wood", "coal", "copper", "hut", "barracks", "army", "levelUp"] as const;
export type BuildOrderGoal = (typeof BUILD_ORDER_GOALS)[number];

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
    return { error: "This isn't JSON. Paste an order copied with Copy JSON, or the JSON an AI wrote." };
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
