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

  it("records submitted transaction hashes without starting movement", () => {
    const source = readSource("worldmap.tsx");

    const submitStart = source.indexOf("private handleSubmittedArmyMovementTx(");
    expect(submitStart).toBeGreaterThan(0);
    const submitEnd = source.indexOf("\n  private ", submitStart + 20);
    expect(submitEnd).toBeGreaterThan(submitStart);
    const submitHandler = source.slice(submitStart, submitEnd);

    expect(submitHandler).toContain('"tx_submitted"');
    expect(submitHandler).toContain("this.pendingArmyMovementTxMap.set(txHash, entityId)");
    expect(submitHandler).not.toContain("startConfirmedArmyMovementOptimisticPlan");
    expect(submitHandler).not.toContain("applyMovementPlan");
  });

  it("starts the optimistic plan from transaction confirmation", () => {
    const source = readSource("worldmap.tsx");

    const handlerStart = source.indexOf("this.handleTransactionComplete = ");
    expect(handlerStart).toBeGreaterThan(0);
    const handlerEnd = source.indexOf("this.handleTransactionFailed = ", handlerStart);
    expect(handlerEnd).toBeGreaterThan(handlerStart);

    const handler = source.slice(handlerStart, handlerEnd);
    expect(handler).toContain('"tx_confirmed"');
    expect(handler).toContain("this.startConfirmedArmyMovementOptimisticPlan(entityId, txHash)");
  });

  it("applies confirmed movement plans at most once", () => {
    const source = readSource("worldmap.tsx");

    const helperStart = source.indexOf("private startConfirmedArmyMovementOptimisticPlan(");
    expect(helperStart).toBeGreaterThan(0);
    const helperEnd = source.indexOf("\n  private ", helperStart + 20);
    expect(helperEnd).toBeGreaterThan(helperStart);
    const helper = source.slice(helperStart, helperEnd);

    expect(helper).toContain("this.pendingMovementPlans.get(entityId)");
    expect(helper).toContain("if (!planPromise) return");
    expect(helper).toContain("this.pendingMovementPlans.delete(entityId)");
    expect(helper).toContain("this.applyConfirmedArmyMovementOptimisticPlan(entityId, txHash, plan)");
    expect(helper.indexOf("this.pendingMovementPlans.delete(entityId)")).toBeLessThan(
      helper.indexOf("this.applyConfirmedArmyMovementOptimisticPlan"),
    );
  });

  it("lets authoritative movement clear pending plans before confirmation", () => {
    const source = readSource("worldmap.tsx");

    const clearStart = source.indexOf("private clearPendingArmyMovementFromAuthoritativePosition(");
    expect(clearStart).toBeGreaterThan(0);
    const clearEnd = source.indexOf("\n  private ", clearStart + 20);
    expect(clearEnd).toBeGreaterThan(clearStart);
    const clearBody = source.slice(clearStart, clearEnd);

    expect(clearBody).toContain("this.pendingMovementPlans.delete(entityId)");
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
