import { afterEach, expect, it, vi } from "vitest";
import { buildStoryEventPresentation, configManager, type SiteKind } from "@bibliothecadao/eternum";
import { siteName, VERDICT_WORDS } from "@bibliothecadao/types";
import { campBeside, SITE, SITE_TILE } from "./site-fixture";
import { fightResultOf } from "./fight-result";

vi.stubGlobal("localStorage", { getItem: () => null });
afterEach(() => vi.restoreAllMocks());
const KINDS = ["Camp", "Rift", "Ruin", "Beasts"] as const;
const SPECIES = { Camp: "Troll", Rift: "Dark fey", Ruin: "Ammit", Beasts: "Cyclops" };

function encounter(kind: SiteKind) {
  const { store } = campBeside(kind);
  store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x72",
      value: {
        ...store.require("ExpeditionSite", { game_id: 1, entity_id: SITE }),
        row: 2,
        initial_guard_count: kind === "Beasts" ? "314000000000" : "1000000000000",
      },
    },
  ] as never);
  if (kind === "Beasts")
    store.applyFacts([
      {
        model: "DepthRules",
        key: "0x777",
        value: {
          game_id: 1,
          depth: 0,
          beast_weak_lower: 300,
          beast_weak_upper: 350,
          beast_strong_lower: 450,
          beast_strong_upper: 550,
          site_guard_lower: 1,
          site_guard_upper: 2,
          reveal_site_neighbors: false,
          entry_stamina: 0,
          chest: { common: 1, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
          reveal_percent: 1,
          ruin_guard_lower: 1,
          ruin_guard_upper: 2,
          guard_step: 1,
        },
      },
    ] as never);
  return store;
}

function battle(army: number, guard: number, defenderId = SITE, defenderPlayer = "0x0") {
  const side = (player: string, after: number) => ({
    player,
    category: "Knight",
    tier: "T1",
    before: "1000000000000",
    after: String(after * 1e9),
    roll: 0,
  });
  return {
    storyType: "BattleEvent",
    storyPayload: {
      attacker_id: 201,
      defender_id: defenderId,
      attacker: side("0x111", army),
      defender: side(defenderPlayer, guard),
    },
    ownerAddress: "0x111",
    viewerAddress: "0x111",
  } as never;
}
const names = (address: string | bigint) => (BigInt(address) === 0x111n ? "clientlane" : "rival");

it.each(KINDS)("shares all verdicts and species with the card for %s, even after clearing", (site) => {
  const store = encounter(site);
  const sent = { targetId: SITE, site, armyId: 201, armyArt: "knight-t1", army: 1000, homeId: 7, clearXp: 50 } as const;
  for (const [army, guard, verdict] of [
    [694, 572, "Guard holds"],
    [694, 0, "Victory"],
    [0, 572, "Army lost"],
    [0, 0, "Army lost"],
  ] as const) {
    const result = fightResultOf(
      sent,
      { army: { before: 1000, after: army }, guard: { before: 1000, after: guard } },
      () => null,
    );
    if (guard === 0)
      store.applyFacts([
        {
          model: "ExpeditionSite",
          key: "0x72",
          value: {
            ...store.require("ExpeditionSite", { game_id: 1, entity_id: SITE }),
            clear: { explorer_id: 201, home_id: 7, reward: null },
          },
        },
        { model: "Structure", key: "0x71", value: null },
        { model: "Guard", key: "0x73", value: null },
      ] as never);
    const story = buildStoryEventPresentation(battle(army, guard), store, names);
    expect(VERDICT_WORDS[result.verdict]).toBe(verdict);
    expect(story.title).toBe(`clientlane vs ${SPECIES[site]} · ${verdict}`);
    expect(story.description).toContain(`Outcome: ${verdict}`);
  }
});

it("uses the same verdict vocabulary for Frontier army fights", () => {
  const store = encounter("Camp");
  expect(buildStoryEventPresentation(battle(694, 572, 301, "0x222"), store, names).title).toBe(
    "clientlane vs rival · Guard holds",
  );
});

it.each(KINDS)("names %s discovery in Events", (kind) => {
  const store = encounter(kind);
  store.applyFacts([{ model: "Structure", key: "0x71", value: null }]);
  const presentation = buildStoryEventPresentation(
    {
      storyType: "ExplorationReward",
      storyPayload: {
        explorer_id: 201,
        coord: { x: SITE_TILE.col, y: 2, alt: false },
        amount: "12500000000",
        resource_type: 38,
      },
    } as never,
    store,
  );
  expect(presentation.title).toBe(`${kind === "Beasts" ? "Cyclops" : `${SPECIES[kind]} ${kind}`} found: +12.5 Essence`);
});

it("does not print a Frontier realm's off-map founding coordinates", () => {
  const store = encounter("Camp");
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
  const presentation = buildStoryEventPresentation(
    {
      storyType: "RealmCreatedStory",
      entityId: 7,
      ownerAddress: "0x111",
      storyPayload: { coord: { x: 2873492105, y: 2873498369 } },
    } as never,
    store,
    names,
  );
  expect(presentation.description).toBe("Settled by clientlane");
});

it("does not invent a Vanguard opponent when an older encounter is outside the synced scope", () => {
  const store = encounter("Camp");
  expect(buildStoryEventPresentation(battle(694, 572, 999), store, names).title).toBe(
    "clientlane vs Beast guard · Guard holds",
  );
});

function captured(entityId = SITE, previousOwner = "0x0") {
  return {
    storyType: "StructureCapturedStory",
    storyPayload: { previous_owner: previousOwner, new_owner: "0x111", points: 0 },
    entityId,
    ownerAddress: "0x111",
    viewerAddress: "0x111",
  } as never;
}

it.each(KINDS)(
  "names a captured %s as its map does, and the beast that held it after its guard was cleared",
  (kind) => {
    const store = encounter(kind);
    const structure = store.require("Structure", { game_id: 1, entity_id: SITE });
    const guard = store.require("Guard", { game_id: 1, structure_id: SITE, slot: 0 });
    store.applyFacts([
      { model: "Structure", key: "0x71", value: { ...structure, owner: "0x111" } },
      {
        model: "ExpeditionSite",
        key: "0x72",
        value: {
          ...store.require("ExpeditionSite", { game_id: 1, entity_id: SITE }),
          clear: { explorer_id: 201, home_id: 7, reward: null },
        },
      },
      { model: "Guard", key: "0x73", value: { ...guard, troops: { ...guard.troops, count: "0" } } },
    ] as never);
    expect(buildStoryEventPresentation(captured(), store, names).title).toBe(
      `clientlane took ${siteName(SITE)} from ${SPECIES[kind]}`,
    );
  },
);

it("does not invent a Vanguard holder for a captured site outside the synced scope", () => {
  expect(buildStoryEventPresentation(captured(999), encounter("Rift"), names).title).toBe(
    "clientlane took a structure from Beast guard",
  );
});

it("names the previous player when a cleared site changes hands again", () => {
  expect(buildStoryEventPresentation(captured(SITE, "0x222"), encounter("Rift"), names).title).toBe(
    `clientlane took ${siteName(SITE)} from rival. Its armies and incoming deliveries went with it`,
  );
});
