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
  // The formatter reads the map centre and the blitz flag off the config singleton, which no test initialises.
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(2147483647);
  vi.spyOn(configManager, "getBlitzConfig").mockReturnValue({
    blitz_mode_on: false,
    blitz_settlement_config: { single_realm_mode: true, two_player_mode: false },
    blitz_exploration_config: { reward_profile_id: 1 },
  });
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
});

type Event = Parameters<typeof buildStoryEventPresentation>[0];

const buildStore = () => {
  const store = new NativeFactStore();
  const write = (model: string, id: number, value: Record<string, unknown>) =>
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [{ hashed_keys: hash.computePoseidonHashOnElements([1, id]), models: { [model]: value } }],
      },
    ]);
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
      metadata: { realm_id: realmId, order: 0, has_wonder: false, village_realm: 0, mine_kind: 0, attunement: 0 },
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

it("names an explorer by its home realm and tier, and its origin by the structure", () => {
  const { store, setStructure, setExplorer } = buildStore();
  setStructure(164316, 1, 2);
  setExplorer(164347, 164316, "T2");
  const presentation = buildStoryEventPresentation(
    story("ExplorerMoveStory", { explorer_id: 164347, explorer_structure_id: 164316, explore: true }, 164316),
    store,
  );
  const realmName = presentation.title.replace(" T2 army moved", "");
  expect(realmName).not.toMatch(/^\s*$|Explorer|\d{5}/);
  expect(presentation.title).toBe(`${realmName} T2 army moved`);
  expect(presentation.description).toContain(`Origin: ${realmName} · Level 2`);
  expect(presentation.description).not.toMatch(/Entity #|Explorer \d/);
});

it("falls back to the home structure from the payload when the explorer row is gone, never an id", () => {
  const { store, setStructure } = buildStore();
  setStructure(164316, 1, 1);
  const retired = buildStoryEventPresentation(story("ExplorerDeleteStory", { explorer_id: 164347 }), store);
  expect(retired.description).toBe("Army disbanded.");
  const moved = buildStoryEventPresentation(
    story("ExplorerMoveStory", { explorer_id: 164347, explorer_structure_id: 164316 }),
    store,
  );
  expect(moved.title).toMatch(/^\S.* army moved$/);
  expect(moved.title).not.toMatch(/\d{5}/);
});

it("describes battle sides and transfer routes through the same resolvers", () => {
  const { store, setStructure, setExplorer } = buildStore();
  setStructure(10, 3, 1);
  setStructure(11, 4, 1);
  setExplorer(20, 10, "T1");
  const battle = buildStoryEventPresentation(
    story("BattleStory", {
      attacker_id: 20,
      defender_id: 11,
      winner_id: 10,
      attacker_owner_id: 10,
      defender_owner_id: 11,
      attacker_troops_before: 100,
      attacker_troops_lost: 10,
      defender_troops_before: 100,
      defender_troops_lost: 100,
    }),
    store,
  );
  expect(battle.description).toMatch(/Attacker \[[^\]]+\]:  \S.* T1 army/);
  expect(battle.description).not.toMatch(/Army \d|Entity #/);
  const transfer = buildStoryEventPresentation(
    story("ResourceTransferStory", { from_entity_id: 10, to_entity_id: 20, resources: [] }),
    store,
  );
  expect(transfer.description).toMatch(/^Route: \S.* → \S.* T1 army/);
});

it("keeps an unknown story to its owner and subject without ids or hashes", () => {
  const { store, setStructure } = buildStore();
  setStructure(7, 5, 1);
  const presentation = buildStoryEventPresentation(
    { ...story("MysteryStory", {}, 7), txHash: "0xdeadbeef" } as Event,
    store,
  );
  expect(presentation.title).toBe("MysteryStory event");
  expect(presentation.description).not.toMatch(/Entity #|Tx:|0xdeadbeef/);
  expect(presentation.description).toMatch(/^Owner: 0x/);
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

it("renders native troop transfer participants after the source explorer has disappeared", () => {
  const { store, setStructure } = buildStore();
  setStructure(12, 1, 0);
  const result = buildStoryEventPresentation(
    story(
      "TroopsTransferred",
      {
        source: { Explorer: "0x9" },
        target: { Guard: { structure_id: "0xc", slot: "0x0" } },
        amount: "0x77359400",
      },
      9,
    ),
    store,
  );
  expect(result.title).toBe("Troops reassigned");
  expect(result.description).toContain("Route: Army");
  expect(result.description).toContain("Delta");
  expect(result.description).toContain("Transferred: 2");
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
