import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
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
        cleared,
      },
    },
  ] as never);

/** The reward a plate says for this structure in this store, read as the structure manager reads it. */
const said = (store: NativeFactStore, structure: ReturnType<typeof structureOf>) =>
  buildStructurePlate(structure, () => 1, 0, readPlateReward(store, structure)).reward;

describe("what a plate says taking a camp or a rift gives", () => {
  afterEach(() => vi.restoreAllMocks());

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

  it("says the points for taking a Blitz camp from the Vanguard, and nothing for a player's camp", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(GAME);
    vi.spyOn(configManager, "getVictoryPointGrants").mockReturnValue({
      claimCampFromBandits: 250,
    } as ReturnType<typeof configManager.getVictoryPointGrants>);
    const store = new NativeFactStore();
    expect(said(store, structureOf(StructureType.Camp))).toBe("250 points");
    expect(said(store, structureOf(StructureType.Camp, 7n))).toBeUndefined();
  });
});
