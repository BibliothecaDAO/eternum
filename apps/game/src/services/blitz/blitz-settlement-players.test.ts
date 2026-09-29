import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import { describe, expect, it } from "vitest";
import { filterPlayersByBlitzSettlement, readBlitzSettlementPlayerAddresses } from "./blitz-settlement-players";

describe("readBlitzSettlementPlayerAddresses", () => {
  it("reads the entered gameplay account and isolates the active game", () => {
    const store = new NativeFactStore();
    configManager.setActiveGame(1, 1);
    store.applyFacts(
      [1, 2].map((game) => ({
        model: "PlayerEntry",
        key: hash.computePoseidonHashOnElements([game, 0x456]),
        value: { game_id: game, owner: "0x456", player: "0x123" },
      })),
    );
    expect(readBlitzSettlementPlayerAddresses(store)).toEqual([0x123n]);
  });
});

describe("filterPlayersByBlitzSettlement", () => {
  it("keeps only identities registered in the current Blitz settlement set", () => {
    const currentPlayer = { address: 0x123n, name: "Current player" };
    const historicalPlayer = { address: 0x456n, name: "Historical player" };

    expect(filterPlayersByBlitzSettlement([currentPlayer, historicalPlayer], [currentPlayer.address])).toEqual([
      currentPlayer,
    ]);
  });

  it("keeps current players even before they score leaderboard points", () => {
    const zeroPointPlayer = { address: 0x123n, name: "Zero point player", points: 0 };

    expect(filterPlayersByBlitzSettlement([zeroPointPlayer], [zeroPointPlayer.address])).toEqual([zeroPointPlayer]);
  });
});
