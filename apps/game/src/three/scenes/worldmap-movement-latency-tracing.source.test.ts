// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(process.cwd(), "../..");
const readSource = (relativePath: string) => readFileSync(resolve(currentDir, relativePath), "utf8");
const readRepoSource = (relativePath: string) => readFileSync(resolve(repositoryRoot, relativePath), "utf8");

describe("Worldmap movement latency tracing wiring", () => {
  it("records tx, visual movement, and completion phases from worldmap", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain('"move_requested"');
    expect(source).toContain('"explore_intent_queued"');
    expect(source).toContain('"explore_submit_started"');
    expect(source).toContain('"explore_tx_hash_received"');
    expect(source).toContain('"tx_response_received"');
    expect(source).toContain('"tx_confirmed"');
    expect(source).toContain('"movement_started"');
    expect(source).toContain('"movement_completed"');
  });

  it("closes explore latency only after the streamed tile reaches a rendered frame", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("beginClientActionLatency");
    expect(source).toContain("recordClientActionSubmitted");
    expect(source).toContain('recordClientActionPhase(exploreLatencyActionId, "ghost_rendered")');
    expect(source).toContain("recordClientActionPreConfirmed");
    expect(source).toContain("recordExploreRevealAfterRender(current.hexCoords, terrainPageRebuild)");
    expect(source).toContain("void terrainPageRebuild.then");
    expect(source).toContain("window.requestAnimationFrame(recordRendered)");
  });

  it("resolves transaction lifetime from the game stream without a worldmap fallback timer", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("waitForTransaction(txHash)");
    expect(source).not.toContain("authoritativePendingArmyMovementMs");
  });

  it("does not treat TileOpt delivery as an army movement phase", () => {
    const syncSource = readRepoSource("apps/game/src/sync/game-sync.ts");
    const listenerSource = readRepoSource("packages/core/src/systems/world-update-listener.ts");

    expect(syncSource).not.toContain("recordTileOptStreamTrace");
    expect(listenerSource).not.toContain("tileopt_component_received");
  });

  it("records next-safe-unblocked when the movement transaction confirms", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain('"explore_next_safe_unblocked"');
  });

  it("gates explore-only confirmation tracing by action type", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("if (actionType === ActionType.Explore)");
  });

  it("exposes debug hooks for reading and clearing movement latency traces", () => {
    const source = readSource("worldmap-debug-hooks.ts");

    expect(source).toContain("getArmyMovementLatencyTrace");
    expect(source).toContain("clearArmyMovementLatencyTrace");
  });
});
