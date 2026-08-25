// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("worldmap provisional movement", () => {
  it("predicts stamina without moving the authoritative spatial coordinate", () => {
    const source = readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
    const methodStart = source.indexOf("private createProvisionalArmyMovementIntent(");
    const methodEnd = source.indexOf("private handleProvisionalArmyMovementFailure(", methodStart);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("createProvisionalIntent");
    expect(body).toContain('model: "ExplorerTroops"');
    expect(body).toContain("troops:");
    expect(body).toContain("stamina:");
    const provisionalPatch = body.slice(body.indexOf("patch:"), body.indexOf("matchPatch:"));
    expect(provisionalPatch).not.toContain("coord:");
    expect(body).toContain("matchPatch:");
    expect(body).toContain("sourcePatch:");
    expect(source).toContain("hasProvisionalInputLock");
    expect(source).not.toContain("paintProvisionalDestinationBiome");
    expect(source).not.toContain("provisionalBiomes");
    expect(source).not.toContain("private pendingArmyMovements");
    expect(source).not.toContain("pendingMovementPlans");
    expect(source).not.toContain("useArmyStaminaSourceStore");
  });

  it("leaves ArmyManager with visual tween state but no optimistic position locks", () => {
    const source = readFileSync(resolve(currentDir, "../managers/army-manager.ts"), "utf8");

    expect(source).toContain("movingArmySourceBuckets");
    expect(source).toContain("movementStartListeners");
    expect(source).not.toContain("optimisticPositionLocks");
    expect(source).not.toContain("[ArmyLock]");
  });
});
