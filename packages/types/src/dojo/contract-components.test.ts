import { createWorld } from "@dojoengine/recs";
import { describe, expect, it } from "vitest";

import { defineContractComponents } from "./contract-components";

describe("defineContractComponents", () => {
  it("exposes the Blitz settlement model used by prize leaderboards", () => {
    const components = defineContractComponents(createWorld(), "s2");
    const blitzSettlement = (components as Record<string, any>).BlitzSettlement;

    expect(blitzSettlement).toBeDefined();
    expect(blitzSettlement.metadata).toMatchObject({
      namespace: "s2",
      name: "BlitzSettlement",
      types: ["u32", "ContractAddress", "Span<u32>"],
      customTypes: [],
    });
    expect(Object.keys(blitzSettlement.schema)).toEqual(["game_id", "player", "structure_ids"]);
  });
});
