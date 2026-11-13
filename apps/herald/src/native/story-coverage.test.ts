import { shortString } from "starknet";
import { describe, expect, it } from "vitest";
import { toJsonValue } from "../model-registry";
import { battleEvent, manifest, raw, schema, setup, storyTag } from "./fixtures";

// Wire payloads follow the Cairo story declarations, independently of the decoder.
const resources = [{ resource_type: 1n, amount: 100n }];
const coord = { alt: true, x: 12n, y: 34n };
const stories: Record<string, { fields: number[]; expected: unknown }> = {
  StructureLevelUpStory: { fields: [2], expected: { new_level: 2n } },
  RealmCreatedStory: { fields: [1, 12, 34], expected: { coord } },
  GuardAddStory: {
    fields: [3, 0, 2, 1, 100],
    expected: { structure_id: 3n, slot: 0n, category: "Crossbowman", tier: "T2", amount: 100n },
  },
  ResourceBurnStory: { fields: [1, 1, 100], expected: { resources } },
  ResourceTransferStory: {
    fields: [2, 3, 17, 7, 34, 1, 1, 100, 0, 60],
    expected: {
      transfer_type: "Delayed",
      from_entity_id: 3n,
      from_entity_owner_address: 17n,
      to_entity_id: 7n,
      to_entity_owner_address: 34n,
      resources,
      is_mint: false,
      travel_time: 60n,
    },
  },
  ResourceReceiveArrivalStory: { fields: [1, 1, 100], expected: { resources } },
  ProductionStory: {
    fields: [2, 50, 1, 1, 100],
    expected: { received_resource_type: 2n, received_amount: 50n, cost: resources },
  },
  BuildingPlacementStory: { fields: [1, 12, 34, 4, 2], expected: { coord, category: 4n, change: "Paused" } },
  BuildingPaymentStory: { fields: [1, 12, 34, 4, 1, 1, 100], expected: { coord, category: 4n, cost: resources } },
  BitcoinAwardStory: {
    fields: [2, 9, 17, 34, 3, 9, 80, 20],
    expected: {
      phase: 2n,
      mine_id: 9n,
      winner: 17n,
      owner: 34n,
      winner_destination: 3n,
      owner_destination: 9n,
      winner_paid: 80n,
      owner_paid: 20n,
    },
  },
  StructureCapturedStory: { fields: [17, 34, 50], expected: { previous_owner: 17n, new_owner: 34n, points: 50n } },
  HyperstructurePoints: { fields: [17, 50], expected: { player: 17n, points: 50n } },
  RewardChestOpened: {
    fields: [7, 3, 1, 12, 34, 17],
    expected: { explorer_id: 7n, structure_id: 3n, coord, amount: 17n },
  },
  RelicChestOpened: {
    fields: [7, 1, 12, 34, 3, 1, 2, 50, 44, 50],
    expected: { explorer_id: 7n, coord, chest: { pack: "Fortress", lucky: true }, relics: [50n, 44n], points: 50n },
  },
  ExplorationReward: {
    fields: [7, 3, 1, 12, 34, 1, 100],
    expected: { explorer_id: 7n, receiver: 3n, coord, resource_type: 1n, amount: 100n },
  },
  SpireDiscovered: {
    fields: [7, 3, 1, 12, 34, 38, 3000],
    expected: { explorer_id: 7n, receiver: 3n, coord, resource_type: 38n, amount: 3000n },
  },
  SeasonEnded: { fields: [17], expected: 17n },
  BlitzFinalized: { fields: [11], expected: 11n },
  RelicCrafted: { fields: [4], expected: 4n },
  RelicActivated: {
    fields: [41, 0, 2000, 1800, 0],
    expected: { relic_id: 41n, recipient: "Explorer", rate_bps: 2000n, duration_seconds: 1800n, radius: 0n },
  },
  SitePayout: {
    fields: [3, 7, 9, 7, 0, 23, 500],
    expected: {
      structure_id: 3n,
      explorer_id: 7n,
      site_id: 9n,
      category: 7n,
      reward: { resource_type: 23n, amount: 500n },
    },
  },
  SiteUsed: {
    fields: [7, 1, 12, 34, 0, 200],
    expected: { explorer_id: 7n, coord, benefit: { Shrine: 200n } },
  },
  SkillPointSpent: {
    fields: [7, 1, 3, 0, 3, 40],
    expected: { explorer_id: 7n, choice: "Logistics", point_rank: 3n, tier: 3n, stamina: 40n },
  },
  LordsWithdrawn: {
    fields: [17, 200, 0, 0],
    expected: { account: 17n, amount: 200n, prize_rank: 0n, prize_count: 0n },
  },
  ExplorerCreateStory: {
    fields: [7, 3, 1, 2, 100, 4],
    expected: {
      explorer_id: 7n,
      structure_id: 3n,
      category: "Paladin",
      tier: "T3",
      amount: 100n,
      spawn_direction: "SouthWest",
    },
  },
  ExplorerAddStory: { fields: [7, 100], expected: { explorer_id: 7n, amount: 100n } },
  ExplorerDeleteStory: { fields: [7], expected: { explorer_id: 7n } },
  GuardDeleteStory: { fields: [3, 0], expected: { structure_id: 3n, slot: 0n } },
  TroopsTransferred: {
    fields: [0, 7, 1, 3, 0, 100],
    expected: { source: { Explorer: 7n }, target: { Guard: { structure_id: 3n, slot: 0n } }, amount: 100n },
  },
};

const standalone = {
  BatchProgress: {
    keys: ["1"],
    data: ["17", "2", "8"],
    key: { game_id: 1n },
    value: { actor: 17n, tx_hash: 2n, remaining: 8n },
  },
  GameplayRejected: {
    keys: ["1", "1", "17", "85"],
    data: [
      shortString.encodeShortString("GAMEPLAY_REJECTED"),
      "0",
      shortString.encodeShortString("domain rejected"),
      "15",
    ],
    key: { game_id: 1n, actor: 17n, tx_hash: 85n },
    value: { status_class: BigInt(shortString.encodeShortString("GAMEPLAY_REJECTED")), reason: "domain rejected" },
  },
  PointsAwarded: {
    keys: ["1", "1", "17"],
    data: ["4", "50", "100", "200"],
    key: { game_id: 1n, player: 17n },
    value: { activity: "Hyperstructure", points: 50n, player_points: 100n, season_points: 200n },
  },
};

function storyVariants() {
  const type = schema.types["world_native::ownership::Story"];
  if (type.type !== "enum") throw new Error("Missing compiled story enum");
  return type.variants;
}

function assertDecoded(event: ReturnType<typeof raw>, key: unknown, value: Record<string, unknown>) {
  const decoded = setup().decoder.decode(event);
  if (decoded.kind !== "event") throw new Error("Expected native event");
  expect(toJsonValue(decoded.key)).toEqual(toJsonValue(key));
  expect(toJsonValue(decoded.value)).toEqual(
    toJsonValue({
      ...value,
      event_position: { block_number: 10, transaction_hash: "0x55", transaction_index: 0, event_index: 0 },
    }),
  );
}

describe("compiled native history coverage", () => {
  it.each([
    [2, "Beasts"],
    [3, "Sanctuaries"],
  ] as const)("keeps Scouting history code %i as %s", (kind, name) => {
    const variant = Number(storyTag("SkillPointSpent"));
    for (const layout of schema.games.events.filter(({ name }) => name === "StoryEvent")) {
      assertDecoded(
        raw({
          from_address: manifest.world.address,
          keys: [...layout.prefix, "2", "1", "0", "17", "0", "3", "0x55"],
          data: [variant, 7, 2, kind, 3, 0, 3, 40, 140].map(String),
        }),
        { game_id: 1n, owner: 17n, entity_id: 3n, tx_hash: 85n },
        {
          story: {
            SkillPointSpent: { explorer_id: 7n, choice: { Scouting: name }, point_rank: 3n, tier: 3n, stamina: 40n },
          },
          timestamp: 140n,
        },
      );
    }
  });
  for (const [name, { fields, expected }] of Object.entries(stories)) {
    it(`decodes ${name} from every Games event prefix`, () => {
      const variant = Number(storyTag(name));
      for (const layout of schema.games.events.filter(({ name }) => name === "StoryEvent")) {
        assertDecoded(
          raw({
            from_address: manifest.world.address,
            keys: [...layout.prefix, "2", "1", "0", "17", "0", "3", "0x55"],
            data: [String(variant), ...fields.map(String), "140"],
          }),
          { game_id: 1n, owner: 17n, entity_id: 3n, tx_hash: 85n },
          { story: { [name]: expected }, timestamp: 140n },
        );
      }
    });
  }

  for (const [name, fixture] of Object.entries(standalone)) {
    it(`decodes the complete ${name} payload`, () => {
      for (const layout of schema.games.events.filter((event) => event.name === name)) {
        assertDecoded(
          raw({
            from_address: manifest.world.address,
            keys: [...layout.prefix, ...fixture.keys],
            data: fixture.data,
          }),
          fixture.key,
          fixture.value,
        );
      }
    });
  }

  it("decodes both combatants and the location in a battle", () => {
    assertDecoded(
      raw(battleEvent()),
      { game_id: 1n, attacker_id: 7n, defender_id: 8n, attacker_owner: 2n, defender_owner: 3n },
      {
        winner_id: 7n,
        coord: { alt: false, x: 12n, y: 34n },
        max_reward: [],
        attacker: { player: 273n, category: "Knight", tier: "T1", before: 100n, after: 90n, roll: 5n },
        defender: { player: 546n, category: "Paladin", tier: "T2", before: 80n, after: 0n, roll: 4n },
        timestamp: 1920n,
      },
    );
  });
});

it.each([60, 5, 0])("decodes the actual capped well gain %s from every story prefix", (gain) => {
  const variant = Number(storyTag("SiteUsed"));
  expect(variant).toBeGreaterThanOrEqual(0);
  for (const layout of schema.games.events.filter(({ name }) => name === "StoryEvent")) {
    assertDecoded(
      raw({
        from_address: manifest.world.address,
        keys: [...layout.prefix, "2", "1", "0", "17", "0", "7", "0x55"],
        data: [String(variant), "7", "1", "12", "34", "1", String(gain), "140"],
      }),
      { game_id: 1n, owner: 17n, entity_id: 7n, tx_hash: 85n },
      { story: { SiteUsed: { explorer_id: 7n, coord, benefit: { Well: BigInt(gain) } } }, timestamp: 140n },
    );
  }
});

it.each([1, 2, 3, 4, 5])("decodes the granted Shrine rank %s from every story prefix", (rank) => {
  const variant = Number(storyTag("SiteUsed"));
  expect(variant).toBeGreaterThanOrEqual(0);
  for (const layout of schema.games.events.filter(({ name }) => name === "StoryEvent")) {
    assertDecoded(
      raw({
        from_address: manifest.world.address,
        keys: [...layout.prefix, "2", "1", "0", "17", "0", "7", "0x55"],
        data: [String(variant), "7", "1", "12", "34", "2", String(rank), "140"],
      }),
      { game_id: 1n, owner: 17n, entity_id: 7n, tx_hash: 85n },
      { story: { SiteUsed: { explorer_id: 7n, coord, benefit: { ShrinePoint: BigInt(rank) } } }, timestamp: 140n },
    );
  }
});
