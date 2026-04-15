import { describe, expect, it } from "vitest";

import { resolveArmyHexBatchApplyPlan } from "./worldmap-army-tile-batch-runtime";
describe("worldmap army hex batch runtime", () => {
  it("plans remove-then-add application for moved armies", () => {
    const plan = resolveArmyHexBatchApplyPlan([
      {
        entityId: 1,
        kind: "upsert",
        oldPos: { col: 10, row: 10 },
        newPos: { col: 11, row: 10 },
        ownerAddress: 123n,
        ownerStructureId: 77,
      },
      {
        entityId: 2,
        kind: "upsert",
        oldPos: { col: 11, row: 10 },
        newPos: { col: 12, row: 10 },
        ownerAddress: 123n,
        ownerStructureId: 77,
      },
    ]);

    expect(plan.occupancyRemovals).toEqual([
      { entityId: 1, position: { col: 10, row: 10 } },
      { entityId: 2, position: { col: 11, row: 10 } },
    ]);
    expect(plan.upserts).toEqual([
      {
        entityId: 1,
        newPos: { col: 11, row: 10 },
        ownerAddress: 123n,
        ownerStructureId: 77,
      },
      {
        entityId: 2,
        newPos: { col: 12, row: 10 },
        ownerAddress: 123n,
        ownerStructureId: 77,
      },
    ]);
  });
});
