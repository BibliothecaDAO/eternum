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
    const prologue = source.slice(start, start + 1000);

    expect(prologue).toContain("isArmyMovingOptimistically(selectedEntityId)");
    expect(prologue).toContain("this.enqueueNextMove(account, actionPath, selectedEntityId)");
  });

  it("records next_move_queued when enqueueing and replays via onMovementComplete", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private enqueueNextMove(");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, start + 1200);

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

  it("clears queued next-move on tx failure, submission failure, fallback timeout, and scene destroy", () => {
    const source = readSource("worldmap.tsx");

    const failureHandler = source.slice(
      source.indexOf("this.handleTransactionFailed = "),
      source.indexOf("this.handleTransactionFailed = ") + 1200,
    );
    expect(failureHandler).toContain("this.clearQueuedNextMove(plan.entityId)");

    const submitCatch = source.indexOf('console.error("Army movement failed:"');
    expect(submitCatch).toBeGreaterThan(0);
    const catchBody = source.slice(submitCatch - 600, submitCatch);
    expect(catchBody).toContain("this.clearQueuedNextMove(selectedEntityId)");

    expect(source).toMatch(/this\.moveQueue\.clearAll\(\)/);
    expect(source).toMatch(/this\.moveQueueDequeueDisposers\.forEach\(\(dispose\) => dispose\(\)\)/);
  });
});
