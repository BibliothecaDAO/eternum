import { StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { getClosestBank } from "./banks";
import { bankPickupTravelSeconds, shipmentTravelSeconds } from "./travel";

afterEach(() => vi.restoreAllMocks());

const REALM = 1;
const BANK = 2;

/** A realm at (10, 10) and a bank at (16, 22): 12 hex steps apart, 13.4 tiles as the crow flies. Goods 9 s a step. */
const world = () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getSpeedConfig").mockImplementation((_kind, troops = false) => (troops ? 27 : 9));
  const store = new NativeFactStore();
  for (const [id, x, y, category] of [
    [REALM, 10, 10, StructureType.Realm],
    [BANK, 16, 22, StructureType.Bank],
  ])
    store.applyFacts([
      {
        model: "Structure",
        key: String(id),
        value: {
          game_id: 1,
          entity_id: id,
          owner: 1n,
          base: {
            category,
            level: 0,
            created_at: 0,
            troop_max_guard_count: 4,
            troop_max_explorer_count: 4,
            starting_troops_granted: true,
          },
          metadata: { realm_id: id, order: 0, has_wonder: false, village_realm: 0, mine_kind: 0, deepest_depth: 0 },
          resources_packed: 0n,
        },
      },
      {
        model: "TileOccupancy",
        key: String(id),
        value: { game_id: 1, entity_id: id, col: x, row: y, alt: false, is_structure: true, category },
      },
    ] as never);
  return store;
};

describe("a journey between a structure and its bank, as the chain times it", () => {
  it("finds the nearest bank by hex steps", () => {
    expect(getClosestBank(REALM, world())).toEqual({ bankId: BANK, distance: 12 });
  });

  it("times a transfer one way, at the troops' pace when troops ride along", () => {
    const store = world();
    expect(shipmentTravelSeconds(REALM, BANK, store, false)).toBe(108);
    expect(shipmentTravelSeconds(REALM, BANK, store, true)).toBe(324);
  });

  it("times a bank pickup as a round trip (economy::pickup_bank_resources), troops slower", () => {
    const store = world();
    expect(bankPickupTravelSeconds(BANK, REALM, store, false)).toBe(216);
    expect(bankPickupTravelSeconds(BANK, REALM, store, true)).toBe(648);
  });
});
