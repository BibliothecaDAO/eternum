// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap optimistic movement wiring", () => {
  it("captures the destination hex alongside the tx → entity map when the tx submits", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("pendingArmyMovementTxTargets");
    expect(source).toMatch(/pendingArmyMovementTxTargets\.set\(\s*txHash\s*,/);
  });

  it("only registers the optimistic target for travel actions (explore rewinds on VRF treasure hit)", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const setIndex = source.indexOf("this.pendingArmyMovementTxTargets.set(txHash");
    expect(setIndex).toBeGreaterThan(-1);
    // Walk backwards from the set() call and find the nearest enclosing
    // `if (...)` condition — it must gate on isTravelAction so explore txs
    // never enter the optimistic pipeline.
    const window = source.slice(Math.max(0, setIndex - 400), setIndex);
    expect(window).toMatch(/if \(isTravelAction\)/);
  });

  it("imports the pure optimistic update builder", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("buildOptimisticArmyTileUpdate");
    expect(source).toContain('from "./worldmap-optimistic-movement"');
  });

  it("resolves the movement optimistically from the tx confirmation handler", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const handlerStart = source.indexOf("this.handleTransactionComplete");
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerBody = source.slice(handlerStart, handlerStart + 1800);
    expect(handlerBody).toContain("resolveArmyMovementOptimistically");
  });

  it("drives the existing cache + army-manager pipeline from the optimistic resolver", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const methodMatch = source.match(/private (?:async )?resolveArmyMovementOptimistically\b/);
    expect(methodMatch).not.toBeNull();
    const methodStart = methodMatch!.index!;
    const methodBody = source.slice(methodStart, methodStart + 2200);
    expect(methodBody).toContain("this.updateArmyHexes(");
    expect(methodBody).toContain("this.armyManager.onTileUpdate(");
  });

  it("records a new movement_resolved_optimistically latency phase", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    expect(source).toContain('"movement_resolved_optimistically"');
  });

  it("tracks optimistically-resolved armies for later indexer convergence", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    expect(source).toContain("optimisticallyResolvedArmies");
    expect(source).toContain('"movement_optimistic_convergence"');
  });

  it("clears optimistic tracking when pending movement is cleared", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const methodStart = source.indexOf("private clearPendingArmyMovement");
    expect(methodStart).toBeGreaterThan(-1);
    const methodBody = source.slice(methodStart, methodStart + 1600);
    expect(methodBody).toContain("pendingArmyMovementTxTargets");
    expect(methodBody).toContain("optimisticallyResolvedArmies");
  });
});
