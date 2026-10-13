import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { campBeside } from "../sites/site-fixture";
import { dayLogLine } from "./day-line";

const story = (name: string, storyPayload: Record<string, unknown>, title = "The story's own title") => ({
  story: name,
  storyPayload,
  presentation: { title },
});

/** The fixture's day with the realm's army 201 in its second slot, as a Frontier army is. */
const dayWithArmyTwo = () => {
  const { store } = campBeside();
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wire = JSON.parse(JSON.stringify(army, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  store.applyFacts([
    { model: "ExplorerTroops", key: "0x74", value: { ...wire, troops: { ...wire.troops, stamina: { Slot: 1 } } } },
  ] as never);
  return store;
};

describe("the day log's line for a story", () => {
  it("writes a reveal's pay as a whole number of the thing it sent home", () => {
    const { store } = campBeside();
    const reveal = (resource: ResourcesIds, amount: string) =>
      dayLogLine(story("ExplorationReward", { resource_type: resource, amount }, "+98.4 Labor"), store);
    expect(reveal(ResourcesIds.Labor, "98400000000")).toBe("+98 labor");
    expect(reveal(ResourcesIds.Essence, "1250000000000")).toBe("+1,250 Essence");
  });

  it("gives a building one line, by its build card's name, and drops the placement that repeats it", () => {
    const { store } = campBeside();
    const farm = { category: BuildingType.ResourceWheat };
    expect(dayLogLine(story("BuildingPaymentStory", { ...farm, cost: [] }), store)).toBe("Farm built");
    expect(dayLogLine(story("BuildingPaymentStory", { category: BuildingType.WorkersHut, cost: [] }), store)).toBe(
      "Hut built",
    );
    expect(dayLogLine(story("BuildingPlacementStory", { ...farm, change: "Created" }), store)).toBeNull();
    expect(
      dayLogLine(story("BuildingPlacementStory", { ...farm, change: "Destroyed" }, "Demolished: Farm"), store),
    ).toBe("Demolished: Farm");
  });

  it("names an army by its number, as its card does, and by Army alone once it has left the map", () => {
    const store = dayWithArmyTwo();
    expect(dayLogLine(story("ExplorerCreateStory", { explorer_id: 201 }), store)).toBe("Army 2 deployed");
    expect(dayLogLine(story("ExplorerDeleteStory", { explorer_id: 201 }), store)).toBe("Army 2 disbanded");
    expect(dayLogLine(story("ExplorerCreateStory", { explorer_id: 999 }), store)).toBe("Army deployed");
  });

  it("keeps the title of any story it has no line of its own for", () => {
    const { store } = campBeside();
    expect(dayLogLine(story("SitePayout", {}, "Camp cleared"), store)).toBe("Camp cleared");
    expect(dayLogLine(story("BuildingPaymentStory", { category: 250, cost: [] }, "Building Constructed"), store)).toBe(
      "Building Constructed",
    );
  });
});
