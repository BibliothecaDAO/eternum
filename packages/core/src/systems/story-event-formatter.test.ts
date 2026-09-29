import { beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { NativeFactStore } from "../client/native-fact-store";
import explorerFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
// The package index first, so the config singleton the utils read through it is evaluated before any story runs.
import { configManager } from "..";
import { buildStoryEventPresentation } from "./story-event-formatter";
import type { NativeStoryVariant } from "../../../../contracts/l3/world-native/schema/client.gen";

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
        deepest_depth: 0,
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
        storyType: "BlitzFinalized",
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

it("explains a LORDS budget fallback without hiding its rarity", () => {
  const result = buildStoryEventPresentation(
    story("ChestReward", {
      quality: 2,
      kind: "Relic",
      depth: 1,
      lords_exhausted: true,
    }),
  );
  expect(result.title).toBe("Chest opened: Rare relic");
  expect(result.description).toContain("LORDS allowance exhausted; awarded a relic of the same rarity");
  expect(() => buildStoryEventPresentation(story("ChestReward", { kind: "Reserved" }))).toThrow(
    "Invalid chest reward kind",
  );
});

describe("every story the chain can tell", () => {
  const side = {
    player: "0x123",
    category: "Knight",
    tier: "T1",
    before: "2000000000000",
    after: "1000000000000",
    roll: 0,
  };
  const coord = { alt: false, x: 10, y: 12 };
  const amount = "550000000000";
  // One sample per generated variant: a variant added to the Story enum fails to type-check here until it has one.
  const SAMPLES: Record<NativeStoryVariant | "BattleEvent" | "RaidEvent", Record<string, unknown>> = {
    FaithPointsClaimedStory: { wonder_id: 5, new_points: 10, total_points: 40 },
    StructureLevelUpStory: { structure_id: 5, new_level: 2 },
    RealmCreatedStory: { realm_id: 1, coord },
    GuardAddStory: { structure_id: 5, slot: 0, category: "Knight", tier: "T1", amount },
    ResourceBurnStory: { resources: [{ resource_type: 23, amount }] },
    ResourceTransferStory: { from: 5, to: 6, resources: [{ resource_type: 23, amount }], transfer_type: "Instant" },
    ResourceReceiveArrivalStory: { resources: [{ resource_type: 23, amount }] },
    ProductionStory: { resource_type: 35, amount },
    BuildingPlacementStory: { category: 37, inner_col: 11, inner_row: 10, created: 1 },
    BuildingPaymentStory: { category: 37, cost: [{ resource_type: 23, amount }] },
    BitcoinAwardStory: {
      phase: 1,
      mine_id: 9,
      winner: "0x123",
      owner: "0x456",
      winner_destination: 5,
      owner_destination: 6,
      winner_paid: amount,
      owner_paid: amount,
    },
    StructureCapturedStory: { previous_owner: "0x0", new_owner: "0x123", points: 10 },
    TradeCreated: {
      trade_id: 1,
      order: {
        maker_id: 5,
        taker_id: 0,
        offered_resource: 23,
        requested_resource: 35,
        offered_per_lot: 1,
        requested_per_lot: 2,
        remaining_lots: 3,
        expires_at: 100,
      },
    },
    TradeAccepted: {
      trade_id: 1,
      maker_id: 5,
      taker_id: 6,
      offered_resource: 23,
      requested_resource: 35,
      offered_amount: amount,
      requested_amount: amount,
    },
    TradeCancelled: { value: 1 },
    BankSwap: {
      bank_id: 2,
      structure_id: 5,
      resource_type: 23,
      lords_amount: amount,
      resource_amount: amount,
      owner_fee: 0,
      lp_fee: 0,
      resource_price: 1,
      buy: true,
    },
    BankLiquidity: { resource_type: 23, add: true },
    HyperstructurePoints: { player: "0x123", points: 5 },
    RelicChestOpened: { explorer_id: 7, coord, relics: [39, 40], points: 1000 },
    ExplorationReward: { explorer_id: 7, receiver: 5, coord, resource_type: 38, amount: "150000000000" },
    SeasonEnded: { value: "0x123" },
    FaithPledged: { structure_id: 5, wonder_id: 6, owner_rate: 1, pledger_rate: 1 },
    FaithRemoved: { structure_id: 5, wonder_id: 6 },
    BlitzFinalized: { value: "0x1" },
    RelicCrafted: { value: 39 },
    ExplorerCreateStory: {
      structure_id: 5,
      explorer_id: 7,
      category: "Knight",
      tier: "T1",
      amount,
      spawn_direction: "East",
    },
    ExplorerAddStory: { explorer_id: 7, amount },
    ExplorerDeleteStory: { explorer_id: 7 },
    GuardDeleteStory: { structure_id: 5, slot: 0 },
    TroopsTransferred: { source: { Explorer: 7 }, target: { Explorer: 8 }, amount },
    ChestReward: { explorer_id: 7, kind: "Token", quality: 3, depth: 1, lords_exhausted: false },
    AttributeChosen: { explorer_id: 7, offer_id: 1, source: "Level", attribute: "Battle", applied: 1, lost: 0 },
    SitePayout: { structure_id: 5, explorer_id: 7, site_id: 9, kind: "Camp", reward: { resource_type: 23, amount } },
    BattleEvent: {
      attacker_id: 7,
      defender_id: 9,
      attacker_owner: 5,
      defender_owner: 0,
      winner_id: 5,
      attacker: side,
      defender: side,
    },
    RaidEvent: { success: true, requested_loot: [{ resource_type: 23, amount }] },
  };

  it.each(Object.entries(SAMPLES))("gives %s its own line, never raw fields", (storyType, payload) => {
    const presentation = buildStoryEventPresentation(story(storyType, payload, 7));
    expect(presentation.title).not.toMatch(/ event$/);
    expect(presentation.title.length).toBeGreaterThan(0);
  });

  it("refuses a story it has no line for, rather than printing its fields", () => {
    expect(() => buildStoryEventPresentation(story("NotAStory", {}))).toThrow("No presentation for story NotAStory");
  });
});
