import { configManager, ResourceManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";

import { buildStructurePlate } from "./map-plate-model";
import { readPlateReward } from "./plate-reward";

const GAME = 1;

const structureOf = (structureType: StructureType, owner = 0n) => ({
  entityId: 42,
  structureType,
  mineKind: undefined,
  structureName: "",
  level: 0,
  isMine: owner !== 0n,
  isAlly: false,
  hasWonder: false,
  owner: { address: owner, ownerName: "", guildName: "" },
  guardArmies: [],
  incomingTroopArrivals: [],
});

/** A Frontier site's fact, as the game sends it: a guard of 100 troops to start with, cleared or not. */
const site = (store: NativeFactStore, cleared: boolean, category: StructureType, troops: number) =>
  store.applyFacts([
    {
      model: "DepthRules",
      key: "0x901",
      value: {
        game_id: GAME,
        depth: 0,
        reveal_percent: 10,
        reveal_cap: 1000,
        rift_essence_bps: 15000,
        site_guard_lower: 100,
        site_guard_upper: 100,
        rift_guard_lower: 100,
        rift_guard_upper: 100,
        reveal_site_neighbors: false,
        guard_step: 1,
        chest: { common: 10000, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
        beast_weak_lower: 100,
        beast_weak_upper: 100,
        beast_strong_lower: 200,
        beast_strong_upper: 200,
      },
    },
    {
      model: "ExpeditionSite",
      key: "0x1",
      value: {
        game_id: GAME,
        entity_id: 42,
        category,
        initial_guard_count: String(BigInt(troops) * BigInt(RESOURCE_PRECISION)),
        alt: false,
        col: 1,
        row: 1,
        clear: cleared ? { explorer_id: "1", home_id: "7", reward: null } : null,
      },
    },
  ] as never);

/** The reward a plate says for this structure in this store, read as the structure manager reads it. */
const said = (store: NativeFactStore, structure: ReturnType<typeof structureOf>) =>
  buildStructurePlate({ ...structure, frontier: true }, 0, readPlateReward(store, structure)).reward;

describe("what a plate says taking a camp or a rift gives", () => {
  afterEach(() => {
    setBlockTimestampSource(null);
    vi.restoreAllMocks();
  });

  it.each([
    [StructureType.Camp, "50 Labor", 100],
    [StructureType.Rift, "150 Essence", 100],
    [StructureType.Beasts, "400 Wheat", 100],
    [StructureType.Beasts, undefined, 200],
  ])(
    "says a Frontier site's payout until its cleared fact arrives, then nothing (category %s)",
    (category, payout, troops) => {
      vi.spyOn(configManager, "getActiveGameId").mockReturnValue(GAME);
      const { store } = frontierDay();
      site(store, false, category, troops);
      expect(said(store, structureOf(category))).toBe(payout);

      // Cleared and taken: the site stays on the map, but its payout went home once and is not offered again.
      site(store, true, category, troops);
      expect(said(store, structureOf(category, 7n))).toBeUndefined();
    },
  );

  it("says what a Blitz camp or Essence Rift holds: a camp's Labor, a rift's Essence; nothing else holds", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(GAME);
    setBlockTimestampSource(() => 1_000);
    const held = vi
      .spyOn(ResourceManager.prototype, "balanceWithProduction")
      .mockImplementation(
        (_tick, resource) =>
          ({ balance: (resource === ResourcesIds.Labor ? 640 : 1_200) * RESOURCE_PRECISION }) as never,
      );
    const store = new NativeFactStore();
    expect(said(store, structureOf(StructureType.Camp))).toBe("640 Labor");
    expect(said(store, { ...structureOf(StructureType.Mine), mineKind: 1 as never })).toBe("1,200 Essence");
    expect(said(store, structureOf(StructureType.Village))).toBeUndefined();
    expect(held).toHaveBeenCalledTimes(2);
  });
});
