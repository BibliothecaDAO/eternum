import { afterEach, describe, expect, it, vi } from "vitest";
import { setWorldOrigin } from "../world-origin";
import type { PreparedTerrainPage, TerrainPageRequest } from "./terrain-types";
import { createAllBiomesTerrainRequest } from "./verification/terrain-verification-fixtures";

// A Frontier site sits about 2^31 hexes from the map centre, far outside the reach of origin (0, 0).
const FRONTIER_ORIGIN = { col: -1315412352, row: -1315406720 };

const shiftedRequest = (request: TerrainPageRequest, by: { col: number; row: number }): TerrainPageRequest => ({
  ...request,
  cells: request.cells.map((cell) => ({ ...cell, col: cell.col + by.col, row: cell.row + by.row })),
});

describe("terrain page worker", () => {
  afterEach(() => {
    setWorldOrigin({ col: 0, row: 0 });
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("builds a Frontier page around the caller's origin, not its own", async () => {
    const postMessage = vi.fn();
    const worker: { onmessage?: (event: MessageEvent) => void; postMessage: typeof postMessage } = { postMessage };
    vi.stubGlobal("self", worker);
    await import("./terrain-page-worker");
    setWorldOrigin({ col: 0, row: 0 });

    worker.onmessage!({
      data: {
        id: 1,
        kind: "terrain-page",
        origin: FRONTIER_ORIGIN,
        request: shiftedRequest(createAllBiomesTerrainRequest(), FRONTIER_ORIGIN),
      },
    } as MessageEvent);

    const response = postMessage.mock.calls[0][0] as { error?: string; page?: PreparedTerrainPage };
    expect(response.error).toBeUndefined();
    const { boxMin, boxMax } = response.page!.buffers.bounds;
    expect(Math.max(...boxMax.map(Math.abs), ...boxMin.map(Math.abs))).toBeLessThan(200);
  });
});
