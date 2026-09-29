import { describe, expect, it } from "vitest";
import { toJsonValue } from "../model-registry";
import { battleEvent, manifest, raw, schema, setup } from "./fixtures";

// Wire payloads follow the Cairo story declarations, independently of the decoder.
const resources = [{ resource_type: 1n, amount: 100n }];
const coord = { alt: true, x: 12n, y: 34n };
const stories: Record<string, { fields: number[]; expected: unknown }> = {
  FaithPointsClaimedStory: { fields: [3, 10, 20], expected: { wonder_id: 3n, new_points: 10n, total_points: 20n } },
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
  TradeCreated: {
    fields: [9, 3, 7, 1, 2, 10, 20, 4, 200],
    expected: {
      trade_id: 9n,
      order: {
        maker_id: 3n,
        taker_id: 7n,
        offered_resource: 1n,
        requested_resource: 2n,
        offered_per_lot: 10n,
        requested_per_lot: 20n,
        remaining_lots: 4n,
        expires_at: 200n,
      },
    },
  },
  TradeAccepted: {
    fields: [9, 3, 7, 1, 2, 40, 80],
    expected: {
      trade_id: 9n,
      maker_id: 3n,
      taker_id: 7n,
      offered_resource: 1n,
      requested_resource: 2n,
      offered_amount: 40n,
      requested_amount: 80n,
    },
  },
  TradeCancelled: { fields: [9], expected: 9n },
  BankSwap: {
    fields: [9, 3, 1, 100, 50, 2, 3, 2, 1],
    expected: {
      bank_id: 9n,
      structure_id: 3n,
      resource_type: 1n,
      lords_amount: 100n,
      resource_amount: 50n,
      owner_fee: 2n,
      lp_fee: 3n,
      resource_price: 2n,
      buy: true,
    },
  },
  BankLiquidity: {
    fields: [9, 3, 1, 100, 50, 20, 2, 0],
    expected: {
      bank_id: 9n,
      structure_id: 3n,
      resource_type: 1n,
      lords_amount: 100n,
      resource_amount: 50n,
      shares: 20n,
      resource_price: 2n,
      add: false,
    },
  },
  HyperstructurePoints: { fields: [17, 50], expected: { player: 17n, points: 50n } },
  RelicChestOpened: {
    fields: [7, 1, 12, 34, 2, 4, 5, 50],
    expected: { explorer_id: 7n, coord, relics: [4n, 5n], points: 50n },
  },
  ExplorationReward: {
    fields: [7, 3, 1, 12, 34, 1, 100],
    expected: { explorer_id: 7n, receiver: 3n, coord, resource_type: 1n, amount: 100n },
  },
  SeasonEnded: { fields: [17], expected: 17n },
  FaithPledged: {
    fields: [3, 9, 2000, 8000],
    expected: { structure_id: 3n, wonder_id: 9n, owner_rate: 2000n, pledger_rate: 8000n },
  },
  FaithRemoved: { fields: [3, 9], expected: { structure_id: 3n, wonder_id: 9n } },
  BlitzFinalized: { fields: [11], expected: 11n },
  RelicCrafted: { fields: [4], expected: 4n },
  SitePayout: {
    fields: [3, 7, 9, 0, 0, 23, 500],
    expected: {
      structure_id: 3n,
      explorer_id: 7n,
      site_id: 9n,
      kind: "Camp",
      reward: { resource_type: 23n, amount: 500n },
    },
  },
  AttributeChosen: {
    fields: [7, 9, 1, 1, 2, 1],
    expected: { explorer_id: 7n, offer_id: 9n, source: "Relic", attribute: "Logistics", applied: 2n, lost: 1n },
  },
  ChestReward: {
    fields: [17, 7, 3, 2, 2, 3, 0],
    expected: {
      player: 17n,
      explorer_id: 7n,
      epoch: 3n,
      depth: 2n,
      kind: "Token",
      quality: 3n,
      lords_exhausted: false,
    },
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
    value: { actor: 17n, nonce: 2n, remaining: 8n },
  },
  ExecutionRecorded: {
    keys: [],
    data: ["1", "17", "2", "0", "9", "2", "77", "0", "0x646f6d61696e2072656a6563746564", "15"],
    key: {},
    value: {
      game_id: 1n,
      actor: 17n,
      nonce: 2n,
      nonce_consumed: false,
      order: 9n,
      status: 2n,
      status_class: 77n,
      reason: "domain rejected",
    },
  },
  PointsAwarded: {
    keys: ["1", "1", "17"],
    data: ["4", "50", "100", "200"],
    key: { game_id: 1n, player: 17n },
    value: { activity: "Hyperstructure", points: 50n, player_points: 100n, season_points: 200n },
  },
  RaidEvent: {
    keys: ["1", "1", "42", "0", "7", "3"],
    data: ["1", "17", "34", "100", "90", "1", "1", "100", "140"],
    key: { game_id: 1n, order: 42n, index: 0n, explorer_id: 7n, structure_id: 3n },
    value: {
      success: true,
      player: 17n,
      target_owner: 34n,
      troops_before: 100n,
      troops_after: 90n,
      requested_loot: resources,
      timestamp: 140n,
    },
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
    toJsonValue({ ...value, event_position: { transaction_hash: "0x55", event_index: 0 } }),
  );
}

describe("compiled native history coverage", () => {
  for (const [name, { fields, expected }] of Object.entries(stories)) {
    it(`decodes ${name} from every Games event prefix`, () => {
      const variant = storyVariants().findIndex((variant) => variant.name === name);
      for (const layout of schema.games.events.filter(({ name }) => name === "StoryEvent")) {
        assertDecoded(
          raw({
            from_address: manifest.world.address,
            keys: [...layout.prefix, "1", "1", "100", "0", "0", "17", "0", "3", "0x55"],
            data: [String(variant), ...fields.map(String), "140"],
          }),
          { game_id: 1n, order: 100n, index: 0n, owner: 17n, entity_id: 3n, tx_hash: 85n },
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
      { game_id: 1n, order: 42n, index: 0n, attacker_id: 7n, defender_id: 8n, attacker_owner: 2n, defender_owner: 3n },
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
