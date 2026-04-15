// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), relativePath), "utf8");

describe("Worldmap army tile batch authoritative apply", () => {
  it("applies occupancy removals before upserts", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private applyResolvedArmyHexBatch(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2600);
    const planPos = methodBody.indexOf("resolveArmyHexBatchApplyPlan(");
    const removalPos = methodBody.indexOf("plan.occupancyRemovals.forEach");
    const trackedRemovalPos = methodBody.indexOf("plan.trackedRemovals.forEach");
    const upsertPos = methodBody.indexOf("plan.upserts.forEach");

    expect(planPos).toBeGreaterThan(-1);
    expect(removalPos).toBeGreaterThan(planPos);
    expect(trackedRemovalPos).toBeGreaterThan(removalPos);
    expect(upsertPos).toBeGreaterThan(trackedRemovalPos);
  });
});
