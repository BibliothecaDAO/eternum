import { RELICS, relicChestRelics, siteName, StructureType } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.spyOn(configManager, "getVictoryPointGrants").mockReturnValue({
    exploreTile: 5,
    openRelicCrate: 250,
    claimCampFromBandits: 250,
    claimHyperstructureFromBandits: 1000,
    hyperstructurePerSecond: 1,
    hyperstructureScale: "flat",
  });
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
  ({ storyType, storyPayload, entityId, ownerAddress: "0x123", viewerAddress: null }) as Event;

describe("owner naming", () => {
  it("names owners through the injected resolver, the zero address as the Vanguard, and the rest by the one rule", () => {
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
        viewerAddress: null,
      },
      undefined,
      resolve,
    );
    expect(presentation.owner).toBe("Lord KB");
    expect(presentation.description).toContain("Attacker [Lord KB]");
    expect(presentation.description).toContain("Defender [The Vanguard]");
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
        viewerAddress: null,
      },
      undefined,
      resolve,
    );
    expect(unnamed.owner).toBe("Lord cdef");
  });
});

it("names a LORDS withdrawal by its whole amount, and another player's by the player", () => {
  const djizus = (address: string) => (BigInt(address) === 0x123n ? "djizus" : null);
  const withdrawn = (view: Event) => buildStoryEventPresentation(view, undefined, djizus);
  expect(withdrawn(own("LordsWithdrawn", { account: "0x123", amount: 200 }))).toMatchObject({
    title: "LORDS withdrawn",
    description: "200 LORDS to L2",
  });
  expect(withdrawn(story("LordsWithdrawn", { account: "0x123", amount: 50 }))).toMatchObject({
    title: "djizus withdrew LORDS",
    description: "50 LORDS to L2",
  });
  expect(withdrawn(own("LordsWithdrawn", { account: "0x123", amount: 12_000 }))).toMatchObject({
    description: "12K LORDS to L2",
  });
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
  expect(presentation.title).toBe("Lord 0123 vs Lord 0456 · Lord 0123 wins");
  expect(presentation.description).toContain("Outcome: Lord 0123 wins");
  expect(presentation.description).toContain("Attacker d20: 20 (+20% damage)");
  expect(presentation.description).toContain("Defender d20: 1 (+1% damage)");
});

/**
 * Each BattleEvent shape combat.cairo emits, as its fields are recorded: army 20 from home 10 (player 0x123), army 22
 * from home 11 (player 0x456), structure 21 guarded by the Vanguard (player 0x0), structure 23 owned by player 0x123.
 */
const BATTLES = {
  "army beats army": { ids: [20, 22], owners: [10, 11], winner: 10, players: ["0x123", "0x456"], after: ["5", "0"] },
  "defending army beats army": {
    ids: [20, 22],
    owners: [10, 11],
    winner: 11,
    players: ["0x123", "0x456"],
    after: ["0", "5"],
  },
  "army beats guard": { ids: [20, 21], owners: [10, 0], winner: 10, players: ["0x123", "0x0"], after: ["5", "0"] },
  "guard beats army": { ids: [20, 21], owners: [10, 0], winner: 21, players: ["0x123", "0x0"], after: ["0", "4"] },
  "guard beats attacking army": {
    ids: [23, 22],
    owners: [0, 11],
    winner: 23,
    players: ["0x123", "0x456"],
    after: ["4", "0"],
  },
  "army beats attacking guard": {
    ids: [23, 22],
    owners: [0, 11],
    winner: 11,
    players: ["0x123", "0x456"],
    after: ["0", "4"],
  },
  "true draw": { ids: [20, 22], owners: [10, 11], winner: 0, players: ["0x123", "0x456"], after: ["5", "4"] },
  "draw against a guard": { ids: [20, 21], owners: [10, 0], winner: 0, players: ["0x123", "0x0"], after: ["5", "4"] },
  "mutual destruction": { ids: [20, 22], owners: [10, 11], winner: 0, players: ["0x123", "0x456"], after: ["0", "0"] },
} as const;

it.each([
  ["army beats army", "Lord 0123 wins"],
  ["defending army beats army", "Lord 0456 wins"],
  ["army beats guard", "Lord 0123 wins"],
  ["guard beats army", "The Vanguard wins"],
  ["guard beats attacking army", "Lord 0123 wins"],
  ["army beats attacking guard", "Lord 0456 wins"],
  ["true draw", "Draw"],
  ["draw against a guard", "Draw"],
  ["mutual destruction", "Both sides fall"],
] as const)("words the outcome of %s as the contract decided it: %s", (battle, expected) => {
  const { ids, owners, winner, players, after } = BATTLES[battle];
  const side = (index: 0 | 1) => ({
    player: players[index],
    category: "Knight",
    tier: "T1",
    before: "10",
    after: after[index],
    roll: 0,
  });
  const { description } = buildStoryEventPresentation(
    story("BattleEvent", {
      attacker_id: ids[0],
      defender_id: ids[1],
      attacker_owner: owners[0],
      defender_owner: owners[1],
      winner_id: winner,
      attacker: side(0),
      defender: side(1),
    }),
  );
  expect(description).toContain(`Outcome: ${expected}`);
  if (!expected.endsWith("wins")) expect(description).not.toContain("wins");
});

it.each([
  [0, "Delta", "Inner Wall"],
  [1, "Gamma", "Castle Wall"],
  [2, "Beta", "Outer Wall"],
  [3, "Alpha", "Watchtower"],
])("names slot %i by its wall, for numeric and named stories alike", (slot, name, label) => {
  for (const value of [slot, name]) {
    const result = buildStoryEventPresentation(
      story("TroopsTransferred", {
        source: { Explorer: "0x9" },
        target: { Guard: { structure_id: "0xc", slot: value } },
        amount: "0x77359400",
      }),
    );
    expect(result.title).toContain(label);
    expect(result.title).not.toContain(name);
    expect(result.title).not.toContain("undefined");
  }
});

it("shows the tier an Upgrade reached and the XP it cost from history", () => {
  expect(
    buildStoryEventPresentation(story("TierBought", { explorer_id: 7, attribute: "Logistics", tier: 3, price: 200 })),
  ).toMatchObject({ title: "Logistics rare", description: "Lord 0123's army · 200 XP" });
});

/** A story the viewer's own account told. */
const own = (storyType: string, payload: Record<string, unknown>): Event => ({
  ...story(storyType, payload),
  viewerAddress: "0x123",
});

it("names a cleared site by its map name, with its recorded kind and payout, without a current structure", () => {
  const result = buildStoryEventPresentation(
    own("SitePayout", {
      structure_id: 3,
      explorer_id: 7,
      site_id: 9,
      category: StructureType.Camp,
      reward: { resource_type: 23, amount: "500000000000" },
    }),
  );
  expect(result.title).toBe(`${siteName(9)} cleared`);
  expect(result.description).toMatch(/^Troll · Lord 0123's army · .*500/);
  expect(
    buildStoryEventPresentation(
      own("SitePayout", {
        structure_id: 3,
        explorer_id: 7,
        site_id: 9,
        category: StructureType.Beasts,
        reward: null,
      }),
    ),
  ).toMatchObject({ title: `${siteName(9)} cleared`, description: "Beasts · Lord 0123's army · XP only" });
  // The name its holder gave it, as the rename control writes it.
  const named = vi
    .spyOn(localStorage, "getItem")
    .mockImplementation((key: string) => (key === "entity-name-9" ? "North Watch" : null));
  try {
    expect(
      buildStoryEventPresentation(
        own("SitePayout", {
          structure_id: 3,
          explorer_id: 7,
          site_id: 9,
          category: StructureType.Camp,
          reward: null,
        }),
      ).title,
    ).toBe("North Watch cleared");
  } finally {
    named.mockRestore();
  }
});

it("names another player's clear by the player, and a ruin's clear as the chest it earns", () => {
  const cleared = (category: number, view: (type: string, payload: Record<string, unknown>) => Event) =>
    buildStoryEventPresentation(
      view("SitePayout", {
        structure_id: 3,
        explorer_id: 7,
        site_id: 9,
        category,
        reward: { resource_type: 39, amount: "120000000000" },
      }),
    ).title;
  expect(cleared(StructureType.Camp, story)).toBe(`Lord 0123 cleared ${siteName(9)}`);
  expect(cleared(StructureType.Ruin, story)).toBe(`Lord 0123 cleared ${siteName(9)}: chest earned`);
  expect(cleared(StructureType.Ruin, own)).toBe(`${siteName(9)} cleared: chest earned`);
});

it("names another player's opened chest by the player, the LORDS it paid or its expiry", () => {
  const opened = (amount: string) =>
    buildStoryEventPresentation(story("RewardChestOpened", { explorer_id: 7, structure_id: 3, coord: {}, amount }));
  expect(opened("50")).toMatchObject({ title: "Lord 0123 opened a chest: 50 LORDS", description: "Lord 0123's army" });
  expect(opened("0").title).toBe("Lord 0123's chest expired: no LORDS paid");
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
    BuildingPlacementStory: { coord: { alt: false, x: 11, y: 10 }, category: 37, change: "Created" },
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
    RelicChestOpened: {
      explorer_id: 7,
      coord,
      chest: { pack: "War", lucky: false },
      relics: [41, 43, 39],
      points: 1000,
    },
    ExplorationReward: { explorer_id: 7, receiver: 5, coord, resource_type: 38, amount: "150000000000" },
    SpireDiscovered: { explorer_id: 7, receiver: 5, coord, resource_type: 38, amount: "3000000000000" },
    SeasonEnded: { value: "0x123" },
    FaithPledged: { structure_id: 5, wonder_id: 6, owner_rate: 1, pledger_rate: 1 },
    FaithRemoved: { structure_id: 5, wonder_id: 6 },
    BlitzFinalized: { value: "0x1" },
    RelicCrafted: { value: 39 },
    RelicActivated: { relic_id: 41, recipient: "Explorer", rate_bps: 2000, duration_seconds: 1800, radius: 0 },
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
    LordsWithdrawn: { account: "0x111", amount },
    TierBought: { explorer_id: 7, attribute: "Battle", tier: 2, price: 100 },
    RewardChestOpened: { explorer_id: 7, structure_id: 5, coord, amount: 17 },
    SitePayout: {
      structure_id: 5,
      explorer_id: 7,
      site_id: 9,
      category: StructureType.Camp,
      reward: { resource_type: 23, amount },
    },
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

  // A battle's lines are parsed into its card (Attacker forces, Winner...); every other description reads as plain words.
  it.each(Object.entries(SAMPLES).filter(([storyType]) => storyType !== "BattleEvent"))(
    "tells %s without a debug label (Field: value)",
    (storyType, payload) => {
      const { description } = buildStoryEventPresentation(story(storyType, payload, 7));
      expect(description ?? "").not.toMatch(/(^|· )[A-Z][a-z]+( [a-z]+)*: /);
    },
  );

  /**
   * The stories no Frontier command tells (its preset's command mask: no trade, bank, faith, relic crafting, raid,
   * transfer or relic chest; a Frontier chest is a reward chest), and the game's own: these may leave their player out.
   */
  const NOT_FRONTIER = new Set([
    "FaithPointsClaimedStory",
    "ResourceTransferStory",
    "TradeCreated",
    "TradeAccepted",
    "TradeCancelled",
    "BankSwap",
    "BankLiquidity",
    "RelicChestOpened",
    "FaithPledged",
    "FaithRemoved",
    "BlitzFinalized",
    "RelicCrafted",
    "RaidEvent",
  ]);

  it.each(Object.entries(SAMPLES).filter(([storyType]) => !NOT_FRONTIER.has(storyType)))(
    "names another player in %s, a line about ground this client never synced",
    (storyType, payload) => {
      const djizus = (address: string) => (BigInt(address) === 0x123n ? "djizus" : null);
      const { title, description } = buildStoryEventPresentation(story(storyType, payload, 7), undefined, djizus);
      expect(`${title} · ${description ?? ""}`).toContain("djizus");
    },
  );

  it("reads a building's placement from the change the story carries, never as an update", () => {
    const placed = (change: string) =>
      buildStoryEventPresentation(story("BuildingPlacementStory", { coord, category: 37, change }, 7)).title;
    // The realm is not in this store: its player tells it.
    expect(placed("Created")).toMatch(/^Lord 0123 built an? .+$/);
    expect(placed("Destroyed")).toMatch(/^Lord 0123's .+ demolished$/);
    expect(placed("Paused")).toMatch(/^Lord 0123's .+ paused$/);
    expect(() => buildStoryEventPresentation(story("BuildingPlacementStory", { coord, category: 37 }, 7))).toThrow(
      "Incomplete building placement story",
    );
  });

  it("tells a dormant spire's find by the Essence it paid", () => {
    const found = story("SpireDiscovered", {
      explorer_id: 7,
      receiver: 5,
      coord,
      resource_type: 38,
      amount: "3000000000000",
    });
    expect(buildStoryEventPresentation(found).title).toBe("Dormant spire found: +3,000 Essence");
  });

  it("refuses a story it has no line for, rather than printing its fields", () => {
    expect(() => buildStoryEventPresentation(story("NotAStory", {}))).toThrow("No presentation for story NotAStory");
  });
});

it("says where an opened chest's relics went, and lists them as their panel does", () => {
  expect(new Set(RELICS.map((relic) => relic.name)).size).toBe(RELICS.length);
  vi.spyOn(configManager, "getPresetId").mockReturnValue(2);
  const { store, setStructure, setExplorer } = buildStore();
  setStructure(5, 1, 1);
  setExplorer(7, 5, "T1");
  const opened = (chest: { pack: "War" | "Explore" | "Produce" | "Fortress"; lucky: boolean }) =>
    buildStoryEventPresentation(
      story("RelicChestOpened", { explorer_id: 7, chest, relics: relicChestRelics(chest) }),
      store,
    );
  expect(opened({ pack: "Explore", lucky: true })).toMatchObject({
    title: "Crate opened: 3 relics to the army Stolsli T1",
    description: "Exploration Relic II, Exploration Reward Relic II, Stamina Relic II",
  });
  expect(opened({ pack: "Produce", lucky: false }).title).toBe("Crate opened: 3 relics to Stolsli");
  expect(opened({ pack: "Fortress", lucky: false }).title).toBe(
    "Crate opened: 1 relic to the army Stolsli T1, 2 to Stolsli",
  );
});

it("names a gone army's chest delivery without its names", () => {
  const chest = { pack: "Produce", lucky: false } as const;
  const { title } = buildStoryEventPresentation(
    story("RelicChestOpened", { explorer_id: 7, chest, relics: relicChestRelics(chest) }),
  );
  expect(title).toBe("Crate opened: 3 relics to its realm");
});

describe("a relic activation", () => {
  const effects = [
    "Increases stamina regeneration by 50%",
    "Increases stamina regeneration by 100%",
    "Increases damage by 20%",
    "Increases damage by 40%",
    "Reduces damage taken by 20%",
    "Reduces damage taken by 40%",
    "Instantly explores a 1-tile radius",
    "Instantly explores a 2-tile radius",
    "Increases exploration rewards by 100%",
    "Increases exploration rewards by 200%",
    "Reduces attacker damage to the structure by 15%",
    "Reduces attacker damage to the structure by 30%",
    "Increases resource production rate by 20%",
    "Increases resource production rate by 40%",
    "Increases labor production rate by 20%",
    "Increases labor production rate by 40%",
    "Increases troop production rate by 15%",
    "Increases troop production rate by 30%",
  ];

  it.each(RELICS)("names $name, its actor, recipient and effect in the Events line", (relic) => {
    vi.spyOn(configManager, "getPresetId").mockReturnValue(2);
    const { store, setStructure, setExplorer } = buildStore();
    setStructure(5, 1, 1);
    setExplorer(7, 5, "T1");
    const reveal = relic.id === 45 || relic.id === 46;
    const recipient = relic.id < 49 ? "Explorer" : relic.id < 51 ? "StructureGuard" : "StructureProduction";
    const target = relic.id < 49 ? "Stolsli T1 army" : relic.id < 51 ? "Stolsli's guards" : "Stolsli";
    const presentation = buildStoryEventPresentation(
      story(
        "RelicActivated",
        {
          relic_id: relic.id,
          recipient,
          rate_bps: relic.rateBps,
          duration_seconds: reveal ? 0 : 1800,
          radius: reveal ? relic.id - 44 : 0,
        },
        relic.id < 49 ? 7 : 5,
      ),
      store,
      () => "Ada",
    );
    expect(presentation.title).toBe(
      `Ada activated ${relic.name} on ${target} · ${effects[relic.id - 39]}${reveal ? "" : relic.id < 41 ? " for 30m of regeneration" : " for 30m"}`,
    );
  });

  it("retains the applied effect after the target is gone and without looking up an active boost", () => {
    expect(
      buildStoryEventPresentation(
        story(
          "RelicActivated",
          {
            relic_id: 41,
            recipient: "Explorer",
            rate_bps: 1250,
            duration_seconds: 1800,
            radius: 0,
          },
          7,
        ),
        undefined,
        () => "Ada",
      ).title,
    ).toBe("Ada activated Damage Relic I on Army · Increases damage by 12.5% for 30m");
  });
});

describe("a capture", () => {
  const names = (address: string) => ({ "0xc1": "clientlane", "0xa1": "uxplay" })[address] ?? null;
  const captured = (previousOwner: string, viewerAddress: string | null, points = 0n) => {
    const { store, setStructure } = buildStore();
    setStructure(5, 1, 1);
    const realm = buildStoryEventPresentation(story("RealmCreatedStory", { coord: { x: 1, y: 1 } }, 5), store).title;
    const presentation = buildStoryEventPresentation(
      {
        ...story("StructureCapturedStory", { previous_owner: previousOwner, new_owner: "0xc1", points }, 5),
        viewerAddress,
      },
      store,
      names,
    );
    return { ...presentation, realm: realm.replace(/ founded$/, "") };
  };

  const aftermath = "Its armies and incoming deliveries went with it";

  it("names who took which structure from whom, and what went with it, in one line", () => {
    const { title, description, realm } = captured("0xa1", null);
    expect(title).toBe(`clientlane took ${realm} from uxplay. ${aftermath}`);
    expect(description).toBeUndefined();
  });

  it("tells the player who lost it that it was taken from them, with or without leading zeros", () => {
    const { title, realm } = captured("0x00a1", "0xa1");
    expect(title).toBe(`clientlane took ${realm} from you. ${aftermath}`);
    expect(captured("0xa1", "0xc1").title).toBe(`clientlane took ${realm} from uxplay. ${aftermath}`);
  });

  it("has nothing that went with it when no player held it, and the points taking it from The Vanguard paid", () => {
    const { title, realm } = captured("0x0", "0xc1", 250_000_000n);
    expect(title).toBe(`clientlane took ${realm} from The Vanguard · +250 points`);
  });
});

it("counts one troop as one", () => {
  const moved = (amount: string) =>
    buildStoryEventPresentation(
      story("TroopsTransferred", { source: { Explorer: 7 }, target: { Explorer: 8 }, amount }),
    ).title;
  expect(moved("1000000000")).toBe("Lord 0123 moved 1 troop between armies");
  expect(moved("2000000000")).toBe("Lord 0123 moved 2 troops between armies");
});

describe("a story's subject", () => {
  it("is named in its title, so a list of titles says which realm each line is about", () => {
    const { store, setStructure } = buildStore();
    setStructure(5, 1, 1);
    const title = (storyType: string, payload: Record<string, unknown>) =>
      buildStoryEventPresentation(story(storyType, payload, 5), store).title;
    const name = title("RealmCreatedStory", { coord: { x: 1, y: 1 } }).replace(/ founded$/, "");
    expect(name).not.toMatch(/^A realm$|\d{6,}/);
    expect(title("ResourceReceiveArrivalStory", { resources: [] })).toBe(`Resources arrived at ${name}`);
    expect(title("ResourceReceiveArrivalStory", { resources: [{ resource_type: 35, amount: "900000000000" }] })).toBe(
      `Wheat ×900 arrived at ${name}`,
    );
    expect(title("StructureLevelUpStory", { new_level: 1 })).toBe(`${name} became a City`);
    expect(title("BuildingPlacementStory", { coord: { x: 1, y: 1 }, category: 37, change: "Created" })).toMatch(
      new RegExp(` built at ${name}$`),
    );
    expect(
      title("GuardAddStory", { structure_id: 5, slot: 1, category: "Knight", tier: "T1", amount: "0x77359400" }),
    ).toBe(`${name}'s Castle Wall reinforced`);
  });

  it("is told by its player when this client never synced the realm or the army, as another player's are", () => {
    const resolve = (address: string) => (BigInt(address) === 0x123n ? "djizus" : null);
    const title = (storyType: string, payload: Record<string, unknown>) =>
      buildStoryEventPresentation(story(storyType, payload, 5), undefined, resolve).title;
    const troops = { category: "Knight", tier: "T1", amount: "149000000000" };
    expect(title("ExplorerCreateStory", { structure_id: 5, explorer_id: 7, ...troops })).toBe("djizus raised an army");
    expect(
      title("TroopsTransferred", { source: { Explorer: 7 }, target: { Explorer: 8 }, amount: "149000000000" }),
    ).toBe("djizus moved 149 troops between armies");
    expect(
      title("TroopsTransferred", {
        source: { Explorer: 7 },
        target: { Guard: { structure_id: 5, slot: 1 } },
        amount: "21000000000",
      }),
    ).toBe("djizus moved 21 troops from an army to the Castle Wall");
    expect(title("BuildingPaymentStory", { coord: { x: 1, y: 1 }, category: 37, cost: [] })).toMatch(
      /^djizus built an? \S/,
    );
    expect(title("GuardAddStory", { structure_id: 5, slot: 1, ...troops })).toBe("djizus reinforced the Castle Wall");
    expect(title("ExplorerAddStory", { explorer_id: 7, ...troops })).toBe("djizus reinforced an army");
    expect(title("ExplorerDeleteStory", { explorer_id: 7 })).toBe("djizus disbanded an army");
    expect(title("StructureLevelUpStory", { new_level: 1 })).toBe("djizus's realm became a City");
    expect(title("ResourceBurnStory", { resources: [] })).toBe("djizus spent resources");
    expect(title("RealmCreatedStory", { coord: { x: 1, y: 1 } })).toBe("djizus founded a realm");
    expect(title("ResourceReceiveArrivalStory", { resources: [] })).toBe("Resources arrived at djizus's realm");
    for (const line of [
      title("ProductionStory", { received_resource_type: 35, received_amount: "1", cost: [] }),
      title("ExplorerCreateStory", { structure_id: 5, explorer_id: 7, ...troops }),
    ])
      expect(line).not.toMatch(/a structure|^Army /);
  });

  it("tells a building's placement and its payment, one action, by the same title", () => {
    const { store, setStructure } = buildStore();
    setStructure(5, 1, 1);
    const placed = buildStoryEventPresentation(
      story("BuildingPlacementStory", { coord: { x: 1, y: 1 }, category: 37, change: "Created" }, 5),
      store,
    );
    const paid = buildStoryEventPresentation(
      story("BuildingPaymentStory", { coord: { x: 1, y: 1 }, category: 37, cost: [] }, 5),
      store,
    );
    expect(paid.title).toBe(placed.title);
  });
});

describe("a resource transfer", () => {
  it("names each end as the structure or the army it is, and leaves out an end the store no longer holds", () => {
    vi.spyOn(configManager, "getPresetId").mockReturnValue(2);
    const { store, setStructure, setExplorer } = buildStore();
    setStructure(5, 1, 1);
    setExplorer(7, 5, "T1");
    const sent = (from: number, to: number) =>
      buildStoryEventPresentation(
        story("ResourceTransferStory", {
          from_entity_id: from,
          to_entity_id: to,
          resources: [],
          transfer_type: { Adjacent: {} },
          travel_time: 0,
        }),
        store,
      );
    expect(sent(5, 7)).toMatchObject({ title: "Resources sent to Stolsli T1 army", description: "from Stolsli" });
    expect(sent(7, 5)).toMatchObject({ title: "Resources sent to Stolsli", description: "from Stolsli T1 army" });
    const gone = sent(98765, 43210);
    expect(gone.title).toBe("Resources sent");
    expect(`${gone.title} ${gone.description ?? ""}`).not.toMatch(/\d{4,}|a structure/);
  });
});

describe("a delivery's story", () => {
  afterEach(() => vi.restoreAllMocks());
  /** QA run 3: wheat sent at 02:50:57 local with 27 s on the road landed at 02:54. */
  const sentAt = (hours: number, minutes: number, seconds: number) => new Date(2026, 9, 17, hours, minutes, seconds);
  const told = (sent: Date, travel: number) => {
    vi.spyOn(configManager, "getPresetId").mockReturnValue(2);
    vi.spyOn(configManager, "getTick").mockReturnValue(180);
    const { store } = buildStore();
    return buildStoryEventPresentation(
      {
        ...story("ResourceTransferStory", {
          from_entity_id: 98765,
          to_entity_id: 43210,
          resources: [],
          transfer_type: { Delayed: {} },
          travel_time: travel,
        }),
        timestamp: sent.getTime(),
      },
      store,
    ).description;
  };

  it("says when the goods land, by the chain's delivery tick, not how long the road is", () => {
    expect(told(sentAt(2, 50, 57), 27)).toBe("lands at 02:54");
    // A road ending a second before 02:51 lands at 02:51; one ending at 02:51:00 is filed in the next tick.
    expect(told(sentAt(2, 50, 32), 27)).toBe("lands at 02:51");
    expect(told(sentAt(2, 50, 33), 27)).toBe("lands at 02:54");
    // An instant transfer has no road and says nothing of one.
    expect(told(sentAt(2, 50, 33), 0)).toBeUndefined();
  });
});

it("leads a fight the viewer's army fell in with the army it cost", () => {
  const fight = (viewerAddress: string | null) =>
    buildStoryEventPresentation({
      ...story("BattleEvent", {
        attacker_id: 20,
        defender_id: 21,
        attacker: {
          player: "0x123",
          category: "Crossbowman",
          tier: "T2",
          before: "10000000000",
          after: "9000000000",
          roll: 0,
        },
        defender: { player: "0x456", category: "Knight", tier: "T1", before: "1000000000000", after: "0", roll: 0 },
      }),
      viewerAddress,
    }).title;
  expect(fight("0x456")).toBe("Army lost: 1,000 Knights · Lord 0123 vs Lord 0456");
  expect(fight("0x0456")).toBe("Army lost: 1,000 Knights · Lord 0123 vs Lord 0456");
  expect(fight("0x123")).toBe("Lord 0123 vs Lord 0456 · Lord 0123 wins");
  expect(fight(null)).toBe("Lord 0123 vs Lord 0456 · Lord 0123 wins");
});

it("says what an explore found, not where nor the points every tile scores", () => {
  const title = buildStoryEventPresentation(
    story("ExplorationReward", {
      explorer_id: 7,
      receiver: 5,
      coord: { x: 2147483651, y: 2147483653 },
      resource_type: 38,
      amount: "200000000000",
    }),
  ).title;
  expect(title).toBe("Explored: +200 Essence");
});

it("writes a small army's find rounded, as every charge and reward reads", () => {
  const title = buildStoryEventPresentation(
    story("ExplorationReward", { explorer_id: 7, receiver: 5, resource_type: 23, amount: "1200000000" }),
  ).title;
  expect(title).toBe("Explored: +1 Labor");
  const tiny = buildStoryEventPresentation(
    story("ExplorationReward", { explorer_id: 7, receiver: 5, resource_type: 23, amount: "100000000" }),
  ).title;
  expect(tiny).toBe("Explored: +<1 Labor");
});

it("adds the points an opened crate scored", () => {
  const chest = { pack: "War", lucky: false } as const;
  const { title } = buildStoryEventPresentation(
    story("RelicChestOpened", { explorer_id: 7, chest, relics: relicChestRelics(chest), points: 250_000_000n }),
  );
  expect(title).toBe("Crate opened: 3 relics to the army · +250 points");
});

it("tells the recorded whole LORDS payment and names its home even after the opening army is gone", () => {
  vi.spyOn(configManager, "getPresetId").mockReturnValue(5);
  const { store, setStructure } = buildStore();
  setStructure(5, 1, 1);
  expect(
    buildStoryEventPresentation(story("RewardChestOpened", { explorer_id: 7, structure_id: 5, amount: 17 }), store)
      .title,
  ).toBe("Chest opened: 17 LORDS to Stolsli");
  expect(
    buildStoryEventPresentation(story("RewardChestOpened", { explorer_id: 7, structure_id: 5, amount: 0 }), store)
      .title,
  ).toBe("Chest expired: no LORDS paid");
});
