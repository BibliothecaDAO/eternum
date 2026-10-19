import { REALM_LEVELS } from "@bibliothecadao/types";

/**
 * A build order as a player writes and shares it: plain text, one step a line, "<how many> <building>" (have at least
 * that many), under the rank heading ("City:") its steps start at; steps before any heading start at Settlement. An
 * optional first "Name: …" line names it; "#" starts a comment. Two rules need no line and always come first, in the
 * suggestions that read an order: level up whenever the realm can, and a worker hut whenever population is 3 from full.
 */

/** The buildings an order names; "military" is the realm's best T1 troop building for its biome. */
const BUILD_ORDER_BUILDINGS = ["farm", "wood", "coal", "copper", "hut", "military"] as const;
export type BuildOrderBuilding = (typeof BUILD_ORDER_BUILDINGS)[number];

/** One step: from `rank` (a realm level) up, have at least `count` of `building`. */
export interface BuildOrderStep {
  rank: number;
  building: BuildOrderBuilding;
  count: number;
}

export interface BuildOrder {
  name: string;
  steps: BuildOrderStep[];
}

/** Why an order's text cannot be read: the first line that cannot, by its number from 1. */
interface BuildOrderError {
  line: number;
  message: string;
}

const MAX_NAME_LENGTH = 40;
const MAX_STEPS = 60;
const MAX_COUNT = 99;

const STEP = /^(\d+)\s+([a-z]+)$/;
const HEADING = /^([A-Za-z]+):$/;
const NAME = /^Name:\s*(.*)$/;

const isBuilding = (word: string): word is BuildOrderBuilding =>
  (BUILD_ORDER_BUILDINGS as readonly string[]).includes(word);

/** Reads an order's text, or names the first line it cannot read. */
export const parseBuildOrder = (
  text: string,
  fallbackName: string,
): { order: BuildOrder } | { error: BuildOrderError } => {
  const steps: BuildOrderStep[] = [];
  let name = fallbackName;
  let rank = 0;
  const lines = text.split("\n");
  for (const [index, raw] of lines.entries()) {
    const line = raw.replace(/#.*$/, "").trim();
    const number = index + 1;
    if (line === "") continue;
    const refuse = (message: string) => ({ error: { line: number, message } });
    const named = NAME.exec(line);
    if (named) {
      if (steps.length > 0 || rank > 0) return refuse("The name comes first");
      if (named[1].length === 0 || named[1].length > MAX_NAME_LENGTH)
        return refuse(`A name is 1 to ${MAX_NAME_LENGTH} characters`);
      name = named[1];
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = REALM_LEVELS.findIndex((word) => word.toLowerCase() === heading[1].toLowerCase());
      if (level === -1) return refuse(`“${heading[1]}” is not a rank: ${REALM_LEVELS.join(", ")}`);
      rank = level;
      continue;
    }
    const step = STEP.exec(line.toLowerCase());
    if (!step) return refuse("A step is a number and a building, as “2 farm”");
    const [, count, building] = step;
    if (!isBuilding(building))
      return refuse(`“${building}” is not a building of an order: ${BUILD_ORDER_BUILDINGS.join(", ")}`);
    if (Number(count) < 1 || Number(count) > MAX_COUNT) return refuse(`A count is 1 to ${MAX_COUNT}`);
    if (steps.length === MAX_STEPS) return refuse(`An order holds at most ${MAX_STEPS} steps`);
    steps.push({ rank, building, count: Number(count) });
  }
  return { order: { name, steps } };
};

/**
 * The owner's order, the default: farms first at each rank, then wood, coal and copper raised together, then the
 * realm's T1 military.
 */
export const DEFAULT_BUILD_ORDER_TEXT = `Settlement:
2 farm
City:
4 farm
1 wood
1 coal
1 copper
2 wood
2 coal
2 copper
1 military
Kingdom:
8 farm
3 wood
3 coal
3 copper
4 wood
4 coal
4 copper
3 military
Empire:
12 farm
5 wood
5 coal
5 copper
6 wood
6 coal
6 copper
5 military`;

const readDefaultOrder = (): BuildOrder => {
  const read = parseBuildOrder(DEFAULT_BUILD_ORDER_TEXT, "Default");
  if ("error" in read) throw new Error(`The default build order does not read: line ${read.error.line}`);
  return read.order;
};

export const DEFAULT_BUILD_ORDER: BuildOrder = readDefaultOrder();
