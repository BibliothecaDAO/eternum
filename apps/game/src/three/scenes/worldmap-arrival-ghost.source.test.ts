// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./worldmap.tsx", import.meta.url), "utf8");

describe("Worldmap arrival ghost wiring", () => {
  it("keeps the acting player's click ghost outside authoritative state", () => {
    expect(source).toContain("shouldCreatePredictiveArrivalGhost");
    expect(source).toContain("this.arrivalGhostManager.upsertLocalArrivalGhost");
    expect(source).toContain("this.installPendingMovementVisualLifecycle({ entityId: selectedEntityId })");
    expect(source).not.toContain("installArrivalGhostIntentSubscription");
    expect(source).not.toContain("movementIntent");
  });

  it("settles from the indexed army lifecycle and clears on submit failure", () => {
    expect(source).toMatch(/armyManager\.onMovementStart[\s\S]*?resolveArrivalGhost\(entityId, "settled"\)/);
    expect(source).toMatch(/handlePendingArmyMovementFailure[\s\S]*?clearArrivalGhost\(entityId, "failed"\)/);
    expect(source).not.toContain("provisional-write-manager");
  });
});
