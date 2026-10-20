// @vitest-environment jsdom
import { configManager, Position } from "@bibliothecadao/eternum";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEntryDestination, settleEntryDestination } from "@/game-entry/entry-destination";

import { cameraHexOf } from "./worldmap-camera-target";
import { MAP_CENTER, worldMapCamera } from "./worldmap-camera.test-support";

beforeEach(() => {
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
  resetEntryDestination();
  window.history.replaceState({}, "", "/g/0xa1/1/map");
});

afterEach(() => vi.restoreAllMocks());

describe("the world map's camera target", () => {
  it("is a map position's normalized hex, from whichever space the position was read in", () => {
    // A Blitz crate beside the centre, and a Frontier site, whose contract hexes are absolute (about 2^31 out).
    expect(cameraHexOf(Position.fromContract({ x: MAP_CENTER + 9, y: MAP_CENTER + 5 }))).toEqual({ col: 9, row: 5 });
    expect(cameraHexOf(Position.fromContract({ x: 2790, y: 8850 }))).toEqual({
      col: 2790 - MAP_CENTER,
      row: 8850 - MAP_CENTER,
    });
    expect(cameraHexOf(Position.fromNormalized({ x: 9, y: 5 }))).toEqual({ col: 9, row: 5 });
  });

  it("opens the map on the entry's Frontier realm, not on its contract hex", async () => {
    const { aimed, scene } = worldMapCamera({ col: 0, row: 0 });
    // What the entry settles for a Frontier realm: its site, as the facts give it.
    settleEntryDestination(Position.fromContract({ x: 2790, y: 8850 }));

    await scene.openOnEntryDestination();

    expect(aimed).toEqual([{ col: 2790 - MAP_CENTER, row: 8850 - MAP_CENTER }]);
  });
});
