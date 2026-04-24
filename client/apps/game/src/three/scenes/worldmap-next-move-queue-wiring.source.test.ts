import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap next-move queue wiring", () => {
  it("holds a WorldmapMoveQueue instance per scene", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("private moveQueue: WorldmapMoveQueue");
    expect(source).toContain('import { WorldmapMoveQueue } from "@/three/scenes/worldmap-move-queue"');
  });

  it("short-circuits onArmyMovement when the army has an active optimistic tween", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private onArmyMovement(account:");
    expect(start).toBeGreaterThan(0);
    const prologue = source.slice(start, start + 2000);

    expect(prologue).toContain("isArmyMovingOptimistically(selectedEntityId)");
    expect(prologue).toContain("this.enqueueNextMove(account, actionPath, selectedEntityId)");
  });

  it("records next_move_queued when enqueueing and replays via onMovementComplete", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private enqueueNextMove(");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, start + 3000);

    expect(body).toContain('"next_move_queued"');
    expect(body).toContain("this.armyManager.onMovementComplete(entityId");
    expect(body).toContain("this.moveQueue.dequeue(entityId)");
    expect(body).toContain("this.onArmyMovement(account, queued.actionPath, entityId)");
  });

  it("allows re-selection while optimistic by passing isOptimisticMovementActive to the selection plan", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toMatch(
      /resolvePendingArmyMovementSelectionPlan\(\{[\s\S]*?isOptimisticMovementActive: this\.armyManager\.isArmyMovingOptimistically/,
    );
  });

  it("drops a queued move when the pending stamina cannot cover the action cost", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private enqueueNextMove(");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, start + 1800);

    expect(body).toContain("this.canAffordMove(entityId, actionPath)");
    expect(body).toContain("toast.error");
  });

  it("re-checks stamina at dequeue before re-submitting", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private enqueueNextMove(");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, start + 3000);

    // canAffordMove must be consulted during the dequeue path on the queued.actionPath.
    expect(body).toContain("this.canAffordMove(entityId, queued.actionPath)");
  });

  it("gates dequeue on both movement complete AND authoritative reconciliation", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private enqueueNextMove(");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, start + 3000);

    // The dequeue helper should consult reconciliation state before re-submitting.
    expect(body).toContain("this.armyManager.hasReceivedAuthoritativeReconciliation(entityId)");
    expect(body).toContain("this.armyManager.onAuthoritativeReconciliation(entityId");
  });

  it("falls back with a toast if authoritative reconciliation never arrives within the timeout", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private enqueueNextMove(");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, start + 3000);

    expect(body).toContain("setTimeout");
    expect(body).toContain("Queued move dropped");
  });

  it("exposes a canAffordMove helper that sums staminaCost over the action path", () => {
    const source = readSource("worldmap.tsx");

    const helperStart = source.indexOf("private canAffordMove(entityId: ID, actionPath: ActionPath[])");
    expect(helperStart).toBeGreaterThan(0);
    const body = source.slice(helperStart, helperStart + 600);

    expect(body).toMatch(/actionPath\.reduce[\s\S]*?staminaCost/);
    expect(body).toContain("army.currentStamina");
  });

  it("runs canAffordMove at the top of onArmyMovement so every submit — not just queued — is gated", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf(
      "private onArmyMovement(account: Account | AccountInterface, actionPath: ActionPath[], selectedEntityId: ID)",
    );
    expect(methodStart).toBeGreaterThan(0);
    // The check must appear before the optimistic-short-circuit branch and before the
    // tx submission path. First 400 chars of the method body comfortably cover the prologue.
    const prologue = source.slice(methodStart, methodStart + 500);

    expect(prologue).toContain("this.canAffordMove(selectedEntityId, actionPath)");
    expect(prologue).toContain("toast.error");
  });

  it("clears queued next-move on tx failure, submission failure, fallback timeout, and scene destroy", () => {
    const source = readSource("worldmap.tsx");

    const failureHandler = source.slice(
      source.indexOf("this.handleTransactionFailed = "),
      source.indexOf("this.handleTransactionFailed = ") + 1200,
    );
    expect(failureHandler).toContain("this.clearQueuedNextMove(plan.entityId)");

    const submitCatch = source.indexOf('console.error("Army movement failed:"');
    expect(submitCatch).toBeGreaterThan(0);
    const catchBody = source.slice(submitCatch - 900, submitCatch);
    expect(catchBody).toContain("this.clearQueuedNextMove(selectedEntityId)");

    expect(source).toMatch(/this\.moveQueue\.clearAll\(\)/);
    expect(source).toMatch(/this\.moveQueueDequeueDisposers\.forEach\(\(dispose\) => dispose\(\)\)/);
  });
});
