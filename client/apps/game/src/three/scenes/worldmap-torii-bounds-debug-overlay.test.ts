// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  buildToriiBoundsDebugOverlayRows,
  removeToriiBoundsDebugOverlay,
  TORII_BOUNDS_DEBUG_OVERLAY_ID,
  upsertToriiBoundsDebugOverlay,
} from "./worldmap-torii-bounds-debug-overlay";

describe("worldmap Torii bounds debug overlay", () => {
  it("summarizes requested and applied subscription bounds", () => {
    const rows = buildToriiBoundsDebugOverlayRows({
      currentChunk: "4:7",
      currentAreaKey: "area:4:7",
      requestedAreaKey: "area:4:7",
      subscribedAreaKey: "area:3:7",
      localBounds: { minCol: 10, maxCol: 18, minRow: 20, maxRow: 28 },
      subscriptionBounds: { minCol: 1_000_010, maxCol: 1_000_018, minRow: 1_000_020, maxRow: 1_000_028 },
      modelCount: 6,
      lastOutcome: "requested",
      updateCounts: {
        tiles: 2,
        structureTiles: 1,
        structures: 3,
        structureBuildings: 0,
        explorerTiles: 4,
        explorerTroops: 5,
      },
    });

    expect(rows).toContainEqual({ label: "Status", value: "pending" });
    expect(rows).toContainEqual({ label: "Chunk", value: "4:7" });
    expect(rows).toContainEqual({ label: "Current Area", value: "area:4:7" });
    expect(rows).toContainEqual({ label: "Subscribed Area", value: "area:3:7" });
    expect(rows).toContainEqual({ label: "Local Bounds", value: "c 10..18 / r 20..28" });
    expect(rows).toContainEqual({ label: "Felt Bounds", value: "c 1000010..1000018 / r 1000020..1000028" });
    expect(rows).toContainEqual({ label: "Models", value: "6" });
    expect(rows).toContainEqual({ label: "Updates", value: "15 / 5s" });
  });

  it("creates, updates, and removes the debug element", () => {
    upsertToriiBoundsDebugOverlay({
      currentChunk: "1:1",
      currentAreaKey: "area:1:1",
      requestedAreaKey: "area:1:1",
      subscribedAreaKey: "area:1:1",
      lastOutcome: "applied",
    });

    const overlay = document.getElementById(TORII_BOUNDS_DEBUG_OVERLAY_ID);
    expect(overlay?.textContent).toContain("Torii Bounds");
    expect(overlay?.textContent).toContain("synced");

    upsertToriiBoundsDebugOverlay({
      currentChunk: "2:1",
      currentAreaKey: "area:2:1",
      requestedAreaKey: "area:2:1",
      subscribedAreaKey: "area:1:1",
      lastOutcome: "requested",
    });

    expect(document.getElementById(TORII_BOUNDS_DEBUG_OVERLAY_ID)?.textContent).toContain("pending");

    removeToriiBoundsDebugOverlay();
    expect(document.getElementById(TORII_BOUNDS_DEBUG_OVERLAY_ID)).toBeNull();
  });
});
