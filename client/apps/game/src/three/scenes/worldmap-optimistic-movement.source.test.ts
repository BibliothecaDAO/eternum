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
    // Widened from 1600 → 2400 to accommodate the per-entity cleanup loop
    // that iterates the batched-tx map-of-sets.
    const methodBody = source.slice(methodStart, methodStart + 2400);
    expect(methodBody).toContain("pendingArmyMovementTxTargets");
    expect(methodBody).toContain("optimisticallyResolvedArmies");
  });

  it("drops a stale optimistic marker when a new pending movement starts so a stalled convergence cannot block future optimistic resolves", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const methodStart = source.indexOf("private markPendingArmyMovement");
    expect(methodStart).toBeGreaterThan(-1);
    const methodBody = source.slice(methodStart, methodStart + 800);
    expect(methodBody).toContain("this.optimisticallyResolvedArmies.delete(entityId)");
  });

  it("mirrors the post-tile-update arrow recalculation the indexer handler runs so overlays follow the optimistic move", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const methodMatch = source.match(/private (?:async )?resolveArmyMovementOptimistically\b/);
    expect(methodMatch).not.toBeNull();
    const methodStart = methodMatch!.index!;
    const methodBody = source.slice(methodStart, methodStart + 2500);
    expect(methodBody).toContain("this.recalculateArrowsForEntity(entityId)");
    expect(methodBody).toContain("this.recalculateArrowsForEntitiesRelatedTo(entityId)");
  });

  it("logs optimistic resolver failures instead of silently dropping them on the fire-and-forget path", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const handlerStart = source.indexOf("this.handleTransactionComplete");
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerBody = source.slice(handlerStart, handlerStart + 2200);
    expect(handlerBody).toMatch(/resolveArmyMovementOptimistically\([\s\S]*?\)\s*\.catch\(/);
  });

  it("imports and wires the stale-update guard into the indexer tile-update handler", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("isStaleOptimisticIndexerUpdate");
    // Gate the call on optimisticallyResolvedArmies so remote / freshly-synced
    // armies without an optimistic marker keep the normal apply path.
    expect(source).toMatch(
      /this\.optimisticallyResolvedArmies\.has\(update\.entityId\)\s*&&\s*isStaleOptimisticIndexerUpdate\(/,
    );
    expect(source).toContain('"movement_optimistic_stale_skipped"');
  });

  it("keeps the optimistic marker set on stale-skip so the LATEST target's indexer delivery still converges", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const phaseIdx = source.indexOf('"movement_optimistic_stale_skipped"');
    expect(phaseIdx).toBeGreaterThan(-1);
    // Walk forward to the `return;` that ends the stale branch and make sure
    // `optimisticallyResolvedArmies.delete` is NOT invoked in between — we
    // want to keep waiting for the authoritative latest-tx update.
    const staleBranch = source.slice(phaseIdx, phaseIdx + 800);
    expect(staleBranch).toContain("return;");
    expect(staleBranch).not.toContain("this.optimisticallyResolvedArmies.delete");
  });

  it("stores txHash → entity SET (not a single entity) so batched multicalls resolve every move, not just the last", () => {
    // Regression guard against the `pendingArmyMovementTxMap` reverting to
    // `Map<string, ID>`. PromiseQueue.processBatch coalesces rapid moves into
    // ONE multicall that returns a single transaction_hash; mapping txHash to
    // a single entity id would only resolve the last-written move optimistically
    // and leave the rest waiting on the indexer.
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toMatch(/pendingArmyMovementTxMap:\s*Map<string,\s*Set<ID>>/);
    expect(source).toMatch(/pendingArmyMovementTxTargets:\s*Map<string,\s*Map<ID,\s*HexPosition>>/);

    // Submit path must ADD to the entity set, not overwrite it.
    expect(source).toMatch(/entitiesForTx\.add\(selectedEntityId\)/);
    // And the target map must key by entity inside the per-tx map so siblings
    // in a batch keep their own destinations.
    expect(source).toMatch(/targetsForTx\.set\(selectedEntityId,/);
  });

  it("iterates every entity attached to a txHash when the tx confirms so a batched multicall resolves every move", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const handlerStart = source.indexOf("this.handleTransactionComplete");
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerBody = source.slice(handlerStart, handlerStart + 2400);

    // A for-of over the entity set (snapshotted to array so downstream
    // handlers that mutate the set — e.g. movement_started clears — don't
    // disturb iteration) is the load-bearing bit.
    expect(handlerBody).toMatch(/for\s*\(\s*const\s+entityId\s+of\s+\[\.\.\.entities\]\s*\)/);
    // Per-entity target lookup inside the loop.
    expect(handlerBody).toMatch(/targetsForTx\?\.get\(entityId\)/);
  });

  it("refreshes armyLastTileSyncAt on a stale-skip so the staleness fallback does not fire mid-optimistic-chain", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const phaseIdx = source.indexOf('"movement_optimistic_stale_skipped"');
    expect(phaseIdx).toBeGreaterThan(-1);
    const staleBranch = source.slice(phaseIdx, phaseIdx + 800);
    expect(staleBranch).toMatch(/this\.armyLastTileSyncAt\.set\(update\.entityId,\s*Date\.now\(\)\)/);
  });
});
