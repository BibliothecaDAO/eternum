import { defineContractComponents } from "@bibliothecadao/types";
import { createWorld, setComponent } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { describe, expect, it } from "vitest";

import { filterPlayersByBlitzSettlement, readBlitzSettlementPlayerAddresses } from "./blitz-settlement-players";

describe("readBlitzSettlementPlayerAddresses", () => {
  it("reads players from the typed BlitzSettlement component", () => {
    const components = defineContractComponents(createWorld(), "s2");
    const playerAddress = 0x123n;
    const settlementEntity = getEntityIdFromKeys([playerAddress]);
    const missingEntity = getEntityIdFromKeys([0x456n]);

    setComponent(components.BlitzSettlement, settlementEntity, {
      game_id: 1,
      player: playerAddress,
      structure_ids: [1, 2, 3],
    });

    expect(readBlitzSettlementPlayerAddresses(components, [settlementEntity, missingEntity])).toEqual([playerAddress]);
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
