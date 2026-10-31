import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { campBeside, SITE } from "../sites/site-fixture";
import { frontierArmyRules } from "../army/progression-rules-fixture";
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
    // A one-troop army's find, 0.4 labor, says no amount (owner, 26 October): what was done, by the feed's rule.
    expect(reveal(ResourcesIds.Labor, "400000000")).toBe("Explored");
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

  it("writes the XP each story moved: a reveal's, a clear's by the guard the site started with, a level-up's price", () => {
    const { store } = campBeside();
    // Prod's rules: 2 XP a reveal. The fixture's site started with 1,100 guards, so its clear pays 82 XP whatever
    // the last attack killed (√(25 × 1,100) = 165, halved).
    store.applyFacts([
      {
        model: "ArmyProgressionRules",
        key: "0x101",
        value: {
          common_xp: 100,
          game_id: 1,
          reveal_xp: 2,
          reveal_xp_per_depth: 1,
          uncommon_xp: 250,
          rare_xp: 500,
          epic_xp: 1000,
          legendary_xp: 2000,
        },
      },
    ] as never);
    const reveal = { resource_type: ResourcesIds.Labor, amount: "98400000000", coord: { x: 1, y: 1 } };
    expect(dayLogLine(story("ExplorationReward", reveal), store)).toBe("+98 labor, +2 XP");
    expect(dayLogLine(story("SitePayout", { site_id: SITE, reward: null }, "Troll cleared"), store)).toBe(
      "Troll cleared, +82 XP",
    );
    expect(dayLogLine(story("SkillPointSpent", { price: "0x64" }, "Battle II"), store)).toBe("Battle II");
    expect(dayLogLine(story("SkillPointSpent", { price: "12500" }, "Battle V"), store)).toBe("Battle V");
    // A clear of a site this client no longer holds keeps its title: no figure is guessed.
    expect(dayLogLine(story("SitePayout", { site_id: 999, reward: null }, "Troll cleared"), store)).toBe(
      "Troll cleared",
    );
  });

  it("keeps the title of any story it has no line of its own for", () => {
    const { store } = campBeside();
    expect(dayLogLine(story("SitePayout", {}, "Troll cleared"), store)).toBe("Troll cleared");
    expect(dayLogLine(story("BuildingPaymentStory", { category: 250, cost: [] }, "Building Constructed"), store)).toBe(
      "Building Constructed",
    );
  });
});

it.each([
  [{ Shrine: 200 }, "Shrine used, +200 XP"],
  [{ ShrinePoint: 3 }, "Shrine used, +1 III skill point"],
  [{ Well: 60 }, "Well used, +60 stamina"],
  [{ Well: 5 }, "Well used, +5 stamina"],
  [{ Well: 0 }, "Well used, +0 stamina"],
])("Today and the Log use the same recorded site gain after the site and army are gone (%j)", (benefit, expected) => {
  const { store } = campBeside();
  store.applyFacts([{ model: "ExplorerTroops", key: "0x74", value: null }]);
  const storyPayload = { explorer_id: 201, coord: { x: 3, y: 4 }, benefit };
  const presentation = buildStoryEventPresentation(
    { storyType: "SiteUsed", storyPayload, entityId: 201, ownerAddress: "0x111", viewerAddress: "0x111" } as never,
    store,
  );
  expect(presentation.title).toBe(expected);
  expect(dayLogLine({ story: "SiteUsed", storyPayload, presentation }, store)).toBe(expected);
});

it.each([
  [0, 2],
  [1, 3],
  [2, 4],
  [3, 5],
])("keeps historical reveal XP at depth %s without a living army", (depth, xp) => {
  const { store } = campBeside();
  store.applyFacts([{ model: "ArmyProgressionRules", key: "0x101", value: frontierArmyRules() }] as never);
  const spacing = store.require("SettlementRules", { game_id: 1 }).spacing;
  const payload = {
    explorer_id: 999,
    coord: { x: 1, y: depth * spacing + 1, alt: false },
    resource_type: ResourcesIds.Labor,
    amount: "1000000000",
  };
  expect(dayLogLine(story("ExplorationReward", payload), store)).toBe(`+1 labor, +${xp} XP`);
});
