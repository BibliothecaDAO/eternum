import { describe, expect, it } from "vitest";

import {
  activeBuildOrder,
  BUILD_ORDER_GOALS,
  buildOrderBookValue,
  buildOrderJson,
  DEFAULT_BUILD_ORDER,
  readBuildOrderBook,
  readBuildOrderText,
  type BuildOrder,
} from "./build-order";
import { buildOrderPrompt } from "./build-order-prompt";

const COAL_RUSH = `{
  "name": "Coal rush",
  "steps": [
    { "rank": "Settlement", "goal": "farm", "count": 2 },
    { "rank": "city", "goal": "coal", "count": 2 },
    { "rank": "City", "goal": "levelUp" },
    { "rank": "Kingdom", "goal": "army", "count": 1 }
  ]
}`;

const read = (text: string) => readBuildOrderText(text);
const order = (text: string): BuildOrder => {
  const result = read(text);
  if ("error" in result) throw new Error(result.error);
  return result.ok;
};
const steps = (...list: object[]) => JSON.stringify({ name: "Mine", steps: list });

describe("a build order's JSON", () => {
  it("reads the owner's default: farms first at each rank, wood, coal and copper together, barracks, the first army", () => {
    const city = DEFAULT_BUILD_ORDER.steps.filter((step) => step.rank === 1);
    expect(DEFAULT_BUILD_ORDER.name).toBe("Default");
    expect(DEFAULT_BUILD_ORDER.steps[0]).toEqual({ rank: 0, goal: "farm", count: 2 });
    expect(city.map(({ goal, count }) => `${count} ${goal}`)).toEqual([
      "4 farm",
      "1 wood",
      "1 coal",
      "1 copper",
      "2 wood",
      "2 coal",
      "2 copper",
      "1 barracks",
      "1 army",
    ]);
    expect(DEFAULT_BUILD_ORDER.steps.at(-1)).toEqual({ rank: 3, goal: "barracks", count: 5 });
  });

  it("reads a pasted order, its ranks in any case and its level up with no count, and copies back to the same order", () => {
    const coalRush = order(COAL_RUSH);
    expect(coalRush).toEqual({
      name: "Coal rush",
      steps: [
        { rank: 0, goal: "farm", count: 2 },
        { rank: 1, goal: "coal", count: 2 },
        { rank: 1, goal: "levelUp", count: 1 },
        { rank: 2, goal: "army", count: 1 },
      ],
    });
    expect(JSON.parse(buildOrderJson(coalRush)).steps[2]).toEqual({ rank: "City", goal: "levelUp" });
    expect(order(buildOrderJson(coalRush))).toEqual(coalRush);
  });

  it.each([
    ["two farms", "This isn't JSON. Use Copy JSON."],
    ['{"name": "Mine"}', 'A build order is { "name": …, "steps": [ … ] }.'],
    [JSON.stringify({ name: " ", steps: [] }), "A name is 1 to 40 characters."],
    [steps(), "An order has 1 to 60 steps."],
    [
      steps({ rank: "City", goal: "mill", count: 2 }),
      "Step 1: “mill” is not a goal: farm, wood, coal, copper, hut, barracks, army, levelUp.",
    ],
    [
      steps({ rank: "Castle", goal: "farm", count: 2 }),
      "Step 1: “Castle” is not a rank: Settlement, City, Kingdom, Empire.",
    ],
    [steps({ rank: "City", goal: "farm", count: 0 }), "Step 1: a count is a whole number from 1 to 99."],
    [steps({ rank: "City", goal: "farm" }), "Step 1: a count is a whole number from 1 to 99."],
    [
      steps({ rank: "City", goal: "farm", count: 4 }, { rank: "Settlement", goal: "farm", count: 2 }),
      "Step 2: it is at Settlement, after a City step: steps go rank by rank.",
    ],
    [steps({ rank: "Empire", goal: "levelUp" }), "Step 1: Empire is the last rank: it has no level up."],
    [steps({ rank: "City", goal: "levelUp" }, { rank: "City", goal: "levelUp" }), "Step 2: City already levels up."],
  ])("says in a player's words why it cannot read %s", (text, error) => {
    expect(read(text)).toEqual({ error });
  });

  it("holds at most 60 steps", () => {
    const sixtyOne = Array.from({ length: 61 }, () => ({ rank: "City", goal: "farm", count: 1 }));
    expect(read(steps(...sixtyOne))).toEqual({ error: "An order has 1 to 60 steps." });
  });
});

describe("a player's saved orders", () => {
  const coalRush = () => order(COAL_RUSH);

  it("reads back what it saved, and follows its active order, or the default with none", () => {
    const book = { orders: [{ id: "a1", order: coalRush() }], active: "a1" };
    expect(readBuildOrderBook(JSON.parse(JSON.stringify(buildOrderBookValue(book))))).toEqual({ ok: book });
    expect(activeBuildOrder(book).name).toBe("Coal rush");
    expect(activeBuildOrder({ ...book, active: null })).toBe(DEFAULT_BUILD_ORDER);
    expect(activeBuildOrder(null)).toBe(DEFAULT_BUILD_ORDER);
  });

  it("refuses more than 20 orders, an active order it does not hold, and an order that does not read", () => {
    const value = (orders: unknown[], active: string | null = null) => ({ orders, active });
    const saved = (id: string) => ({ id, order: { name: "Mine", steps: [{ rank: "City", goal: "farm", count: 1 }] } });
    const many = Array.from({ length: 21 }, (_, index) => saved(`o${index}`));
    expect(readBuildOrderBook(value(many))).toEqual({ error: "You can keep 20 build orders." });
    expect(readBuildOrderBook(value([saved("a")], "b"))).toEqual({ error: "Saved build orders could not be read." });
    expect(readBuildOrderBook(value([saved("a"), saved("a")]))).toEqual({
      error: "Saved build orders could not be read.",
    });
    expect(readBuildOrderBook(value([{ id: "a", order: { name: "Mine", steps: [] } }]))).toEqual({
      error: "An order has 1 to 60 steps.",
    });
  });
});

describe("the prompt a player copies for an AI", () => {
  it("explains every goal of the language and carries the player's order as JSON", () => {
    const prompt = buildOrderPrompt(order(COAL_RUSH));
    for (const goal of BUILD_ORDER_GOALS) expect(prompt).toContain(`- ${goal}: `);
    expect(prompt).toContain(buildOrderJson(order(COAL_RUSH)));
    expect(prompt.endsWith("Answer with the improved order's JSON only, so I can paste it into the game.")).toBe(true);
  });
});
