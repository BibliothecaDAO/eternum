import { beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { NativeFactStore } from "../client/native-fact-store";
import explorerFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
// The package index first, so the config singleton the utils read through it is evaluated before any story runs.
import { configManager } from "..";
import { buildStoryEventPresentation } from "./story-event-formatter";

// Structure names check the player's local renames first; core tests have no DOM.
vi.stubGlobal("localStorage", { getItem: () => null });
beforeEach(() => {
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(2147483647);
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
});

type Event = Parameters<typeof buildStoryEventPresentation>[0];

const buildStore = () => {
  const store = new NativeFactStore();
  const write = (model: string, id: number, value: Record<string, unknown>) =>
    store.applyFacts([{ model, key: hash.computePoseidonHashOnElements([1, id]), value }]);
  const setStructure = (id: number, realmId: number, level: number) =>
    write("Structure", id, {
      game_id: 1,
      entity_id: id,
      owner: 0x123n,
      base: {
        category: 1,
        level,
        created_at: 0,
        troop_max_guard_count: 4,
        troop_max_explorer_count: 4,
        starting_troops_granted: true,
      },
      metadata: {
        realm_id: realmId,
        order: 0,
        has_wonder: false,
        village_realm: 0,
        mine_kind: 0,
        attunement: 0,
        barracks_tier: 0,
      },
      resources_packed: 0n,
    });
  const setExplorer = (id: number, owner: number, tier: string) =>
    write("ExplorerTroops", id, {
      ...explorerFixture.expected.value,
      game_id: 1,
      explorer_id: id,
      owner,
      troops: { ...explorerFixture.expected.value.troops, tier },
    });
  return { store, setStructure, setExplorer };
};

const story = (storyType: string, storyPayload: Record<string, unknown>, entityId: number | null = null): Event =>
  ({ storyType, storyPayload, entityId, ownerAddress: "0x123" }) as Event;

describe("owner naming", () => {
  it("names owners through the injected resolver, reads the zero address as Neutral, and shortens the rest", () => {
    const resolve = (address: string) => (address === "0x70bf" ? "Lord KB" : null);
    const presentation = buildStoryEventPresentation(
      {
        ownerAddress: "0x70bf",
        ownerName: null,
        entityId: 1,
        txHash: "0x1",
        timestamp: 0,
        storyType: "BattleEvent",
        storyPayload: {
          attacker_id: 1,
          defender_id: 2,
          attacker_owner: 1,
          defender_owner: 2,
          winner_id: 1,
          attacker: { player: "0x70bf", category: "Knight", tier: "T1", before: "10", after: "10", roll: 0 },
          defender: { player: "0x0", category: "Knight", tier: "T1", before: "10", after: "0", roll: 0 },
        },
        rawStory: {},
      },
      undefined,
      resolve,
    );
    expect(presentation.owner).toBe("Lord KB");
    expect(presentation.description).toContain("Attacker [Lord KB]");
    expect(presentation.description).toContain("Defender [Neutral]");
    const unnamed = buildStoryEventPresentation(
      {
        ownerAddress: "0x1234567890abcdef",
        ownerName: null,
        entityId: 1,
        txHash: "0x1",
        timestamp: 0,
        storyType: "Unknown",
        storyPayload: {},
        rawStory: {},
      },
      undefined,
      resolve,
    );
    expect(unnamed.owner).toBe("0x1234…cdef");
  });
});

it("names a chest's quality and ground only when the story carries them", () => {
  expect(buildStoryEventPresentation(story("ChestReward", { quality: 2, kind: "Relic", depth: 1 }))).toMatchObject({
    title: "Chest opened: Rare relic",
    description: "Army · On Ethereal I",
  });
  const bare = buildStoryEventPresentation(story("ChestReward", {}));
  expect(bare.title).toBe("Chest opened: reward");
  expect(bare.description).toBe("Army");
});

it("formats native battle sides and positive Ethereal rolls without a legacy row projection", () => {
  const presentation = buildStoryEventPresentation(
    story("BattleEvent", {
      attacker_id: 20,
      defender_id: 21,
      attacker_owner: 10,
      defender_owner: 11,
      winner_id: 10,
      attacker: {
        player: "0x123",
        category: "Crossbowman",
        tier: "T2",
        before: "10000000000",
        after: "9000000000",
        roll: 20,
      },
      defender: { player: "0x456", category: "Knight", tier: "T1", before: "10000000000", after: "0", roll: 1 },
    }),
  );
  expect(presentation.title).toBe("Battle resolved");
  expect(presentation.description).toContain("Winner: Attacker");
  expect(presentation.description).toContain("Attacker d20: 20 (+20% damage)");
  expect(presentation.description).toContain("Defender d20: 1 (+1% damage)");
});

it.each([
  [0, "Delta", "Delta"],
  [1, "Gamma", "Gamma"],
  [2, "Beta", "Beta"],
  [3, "Alpha", "Alpha"],
])("renders slot %i consistently for numeric and named stories", (slot, name, label) => {
  for (const value of [slot, name]) {
    const result = buildStoryEventPresentation(
      story("TroopsTransferred", {
        source: { Explorer: "0x9" },
        target: { Guard: { structure_id: "0xc", slot: value } },
        amount: "0x77359400",
      }),
    );
    expect(result.description).toContain(label);
    expect(result.description).not.toContain("undefined");
  }
});

it("shows applied attribute levels and lost excess from history without reconstructing current levels", () => {
  expect(
    buildStoryEventPresentation(
      story("AttributeChosen", {
        explorer_id: 7,
        offer_id: 9,
        source: "Relic",
        attribute: "Logistics",
        applied: 1,
        lost: 3,
      }),
    ),
  ).toMatchObject({ title: "Logistics +1", description: "Army · 3 levels lost at the cap" });
});

it("renders the site's recorded kind and payout without a current structure", () => {
  const result = buildStoryEventPresentation(
    story("SitePayout", {
      structure_id: 3,
      explorer_id: 7,
      site_id: 9,
      kind: "Camp",
      reward: { resource_type: 23, amount: "500000000000" },
    }),
  );
  expect(result.title).toBe("Camp cleared");
  expect(result.description).toContain("500");
  expect(
    buildStoryEventPresentation(
      story("SitePayout", {
        structure_id: 3,
        explorer_id: 7,
        site_id: 9,
        kind: "FallenRealm",
        reward: null,
      }),
    ),
  ).toMatchObject({ title: "Fallen realm cleared", description: "Army · Closed chest on the tile" });
});
