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
        coord_x: 2147483650,
        coord_y: 2147483660,
        alt: false,
        created_at: 0,
        troop_explorer_count: 0,
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
      troop_explorers: [],
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

it("uses the winning owner structure from Herald even when survivors format with separators", () => {
  const presentation = buildStoryEventPresentation(
    story("BattleStory", {
      attacker_id: "0x25848",
      defender_id: "0x253a4",
      winner_id: "0x2581f",
      attacker_owner_id: "0x2581f",
      defender_owner_id: "0x25381",
      attacker_owner_address: "0x123",
      defender_owner_address: "0x456",
      attacker_troops_before: "0x3289eee6a00",
      attacker_troops_lost: "0x649534e00",
      defender_troops_before: "0x174876e800",
      defender_troops_lost: "0x174876e800",
    }),
  );
  expect(presentation.description).toContain("Winner: Attacker");
  expect(presentation.description).not.toContain("Winner: Draw");
});

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
        storyType: "BattleStory",
        storyPayload: { attacker_owner_address: "0x70bf", defender_owner_address: "0x0", winner_id: 1, attacker_id: 1 },
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

it("shows the confirmed d20 bonuses and tolerates older stories without rolls", () => {
  const event = story("BattleStory", { attacker_roll: 1, defender_roll: 20 });
  const description = buildStoryEventPresentation(event).description;
  expect(description).toContain("Attacker d20: 1 (+1% damage)");
  expect(description).toContain("Defender d20: 20 (+20% damage)");
  expect(buildStoryEventPresentation(story("BattleStory", {})).description).toBeUndefined();
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
