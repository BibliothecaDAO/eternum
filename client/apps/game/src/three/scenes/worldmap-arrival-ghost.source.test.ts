// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./worldmap.tsx", import.meta.url), "utf8");

describe("Worldmap arrival ghost wiring", () => {
  it("creates movement ghosts and subscribes them to the movement intent", () => {
    expect(source).toContain("shouldCreatePredictiveArrivalGhost");
    expect(source).toContain("this.arrivalGhostManager.upsertLocalArrivalGhost");
    expect(source).toContain("this.installArrivalGhostIntentSubscription(selectedEntityId, movementIntent)");
  });

  it("settles or fails ghosts only from manager outcomes", () => {
    expect(source).toContain('outcome === "settled"');
    expect(source).toContain('resolveArrivalGhost(entityId, "settled")');
    expect(source).toContain('clearArrivalGhost(entityId, "failed")');
    expect(source).not.toContain('clearArrivalGhost(entityId, "movement_evicted")');
    expect(source).not.toContain('clearArrivalGhost(entityId, "arrived")');
  });
});
