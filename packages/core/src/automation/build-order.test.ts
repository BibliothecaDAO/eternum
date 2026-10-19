import { describe, expect, it } from "vitest";

import { DEFAULT_BUILD_ORDER, parseBuildOrder } from "./build-order";

describe("a build order's text", () => {
  it("reads the owner's default: farms first at each rank, then wood, coal and copper together, then military", () => {
    const city = DEFAULT_BUILD_ORDER.steps.filter((step) => step.rank === 1);
    expect(DEFAULT_BUILD_ORDER.name).toBe("Default");
    expect(DEFAULT_BUILD_ORDER.steps[0]).toEqual({ rank: 0, building: "farm", count: 2 });
    expect(city.map(({ building, count }) => `${count} ${building}`)).toEqual([
      "4 farm",
      "1 wood",
      "1 coal",
      "1 copper",
      "2 wood",
      "2 coal",
      "2 copper",
      "1 military",
    ]);
    expect(DEFAULT_BUILD_ORDER.steps.at(-1)).toEqual({ rank: 3, building: "military", count: 5 });
  });

  it("reads a player's order: its name, its ranks, comments and blank lines left out", () => {
    const read = parseBuildOrder(
      "Name: Coal rush\n# coal before anything\n\n2 farm\ncity:\n2 Coal  # the rush\n",
      "Mine",
    );
    expect(read).toEqual({
      order: {
        name: "Coal rush",
        steps: [
          { rank: 0, building: "farm", count: 2 },
          { rank: 1, building: "coal", count: 2 },
        ],
      },
    });
  });

  it.each([
    ["City:\n2 mill", 2, "“mill” is not a building of an order: farm, wood, coal, copper, hut, military"],
    ["Castle:\n2 farm", 1, "“Castle” is not a rank: Settlement, City, Kingdom, Empire"],
    ["2 farm\nfarm 2", 2, "A step is a number and a building, as “2 farm”"],
    ["0 farm", 1, "A count is 1 to 99"],
    ["2 farm\nName: Late", 2, "The name comes first"],
  ])("names the first line it cannot read: %j", (text, line, message) => {
    expect(parseBuildOrder(text, "Mine")).toEqual({ error: { line, message } });
  });

  it("holds at most 60 steps", () => {
    const read = parseBuildOrder(Array.from({ length: 61 }, () => "1 farm").join("\n"), "Mine");
    expect(read).toEqual({ error: { line: 61, message: "An order holds at most 60 steps" } });
  });
});
