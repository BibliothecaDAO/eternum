import { defineContractComponents } from "@bibliothecadao/types";
import { createWorld, setComponent } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { describe, expect, it } from "vitest";

import { readBlitzSettlementPlayerAddresses } from "./blitz-settlement-players";

describe("readBlitzSettlementPlayerAddresses", () => {
  it("reads players from the typed BlitzSettlement component", () => {
    const components = defineContractComponents(createWorld());
    const playerAddress = 0x123n;
    const settlementEntity = getEntityIdFromKeys([playerAddress]);
    const missingEntity = getEntityIdFromKeys([0x456n]);

    setComponent(components.BlitzSettlement, settlementEntity, {
      player: playerAddress,
      structure_ids: [1, 2, 3],
    });

    expect(readBlitzSettlementPlayerAddresses(components, [settlementEntity, missingEntity])).toEqual([playerAddress]);
  });
});
