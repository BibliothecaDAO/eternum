import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap optimistic movement wiring", () => {
  it("tracks a pending movement plan promise per entity", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("pendingMovementPlans: Map<ID, Promise<ArmyMovementPlan | null>>");
  });

  it("kicks off computeMovementPlan in parallel with the tx submit", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toMatch(/this\.armyManager[\s\S]*?\.computeMovementPlan/);
    expect(source).toMatch(/this\.pendingMovementPlans\.set/);
  });

  it("applies the optimistic plan from handleTransactionComplete on tx_confirmed", () => {
    const source = readSource("worldmap.tsx");

    const handlerStart = source.indexOf("this.handleTransactionComplete = ");
    expect(handlerStart).toBeGreaterThan(0);
    const handlerEnd = source.indexOf("this.handleTransactionFailed = ", handlerStart);
    expect(handlerEnd).toBeGreaterThan(handlerStart);

    const handler = source.slice(handlerStart, handlerEnd);
    expect(handler).toContain('"tx_confirmed"');
    expect(handler).toContain("applyMovementPlan");
    expect(handler).toContain("optimistic: true");
    expect(handler).toContain('"optimistic_animation_started"');
  });

  it("rewinds optimistic movement when the tx fails", () => {
    const source = readSource("worldmap.tsx");

    const handlerStart = source.indexOf("this.handleTransactionFailed = ");
    expect(handlerStart).toBeGreaterThan(0);
    const handlerEnd = source.indexOf("}\n", handlerStart + 200);
    expect(handlerEnd).toBeGreaterThan(handlerStart);

    const handler = source.slice(handlerStart, handlerEnd);
    // The worldmap seam pairs the armyManager rewind with an armyHexes
    // spatial-cache rewind so the destination stops resolving in
    // getHexagonEntity after the mesh snaps back.
    expect(handler).toContain("rewindOptimisticMovementAndArmyHexes");
  });

  it("clears pending movement plans when the move resolves or fails", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toMatch(/this\.pendingMovementPlans\.delete/);
  });
});
