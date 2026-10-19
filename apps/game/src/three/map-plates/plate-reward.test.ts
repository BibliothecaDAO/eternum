import { configManager, ResourceManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  owner: { address: owner, ownerName: "", guildName: "" },
  guardArmies: [],
  incomingTroopArrivals: [],
});

/** A Frontier site's fact, as the game sends it: a guard of 100 troops to start with, cleared or not. */
const site = (store: NativeFactStore, cleared: boolean) =>
  store.applyFacts([
    {
      model: "ExpeditionSite",
      key: "0x1",
      value: {
        game_id: GAME,
        entity_id: 42,
        initial_guard_count: String(100n * BigInt(RESOURCE_PRECISION)),
        alt: false,
        col: 1,
        row: 1,
        clear: cleared ? { explorer_id: "1", home_id: "7", reward: null } : null,
      },
    },
  ] as never);

/** The reward a plate says for this structure in this store, read as the structure manager reads it. */
const said = (store: NativeFactStore, structure: ReturnType<typeof structureOf>) =>
  buildStructurePlate(structure, 0, readPlateReward(store, structure)).reward;

describe("what a plate says taking a camp or a rift gives", () => {
  afterEach(() => {
    setBlockTimestampSource(null);
    vi.restoreAllMocks();
  });

  it.each([
    [StructureType.Camp, "50 Labor"],
    [StructureType.Rift, "300 Essence"],
  ])("says a Frontier site's payout until its cleared fact arrives, then nothing (category %s)", (category, payout) => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(GAME);
    const store = new NativeFactStore();
    site(store, false);
    expect(said(store, structureOf(category))).toBe(payout);

    // Cleared and taken: the site stays on the map, but its payout went home once and is not offered again.
    site(store, true);
    expect(said(store, structureOf(category, 7n))).toBeUndefined();
  });

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
