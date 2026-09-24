import { afterEach, describe, expect, it, vi } from "vitest";
import { configManager, NEUTRAL_BIOME_CLIMATE, Position } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { createHexceptionTerrainRequest } from "./scenes/hexception-terrain";
import { hexCellKey, hexCellFromKey } from "./terrain/hex-cell-key";
import { findNearestTerrainHex, terrainHexToWorld } from "./terrain/terrain-coordinates";
import { localHexPosition } from "./scenes/hexception-layout";
import { getHexForWorldPosition, getWorldPositionForHex } from "./utils/utils";
import { isWithinWorldOriginReach, setWorldOrigin, worldOrigin } from "./world-origin";

const MAP_CENTER = 2147483646;

describe("world origin", () => {
  afterEach(() => {
    setWorldOrigin({ col: 0, row: 0 });
    vi.restoreAllMocks();
  });

  it("draws a Frontier realm at col 570850 near the origin and picks it back to its contract coordinate", () => {
    vi.spyOn(configManager, "getMapCenter").mockReturnValue(MAP_CENTER);
    const site = { x: 570850, y: 1250 };
    const normalized = Position.fromContract(site).getNormalized();
    const hex = { col: normalized.x, row: normalized.y };
    expect(isWithinWorldOriginReach(hex)).toBe(false);

    setWorldOrigin(hex);
    expect(Math.abs(worldOrigin().row % 2)).toBe(0);

    const drawn = getWorldPositionForHex(hex);
    expect(Math.abs(drawn.x)).toBeLessThan(200);
    expect(Math.abs(drawn.z)).toBeLessThan(200);
    const terrain = terrainHexToWorld(hex.col, hex.row);
    expect(terrain.x).toBeCloseTo(drawn.x, 6);
    expect(terrain.z).toBeCloseTo(drawn.z, 6);
    expect(hexCellFromKey(hexCellKey(hex.col, hex.row))).toEqual(hex);

    const picked = getHexForWorldPosition(drawn);
    expect(picked).toEqual(hex);
    expect(findNearestTerrainHex(drawn.x, drawn.z)).toEqual(hex);
    expect(Position.fromNormalized({ x: picked.col, y: picked.row }).getContract()).toEqual(site);
  });

  it("leaves Blitz hexes where they were drawn at origin 0", () => {
    const hex = { col: 37, row: -12 };
    expect(isWithinWorldOriginReach(hex)).toBe(true);
    const drawn = getWorldPositionForHex(hex);
    expect(drawn.x).toBeCloseTo(37 * Math.sqrt(3), 9);
    expect(drawn.z).toBeCloseTo(-18, 9);
  });

  it("places the local realm scene's buildings exactly as with origin 0 when the world origin moves", () => {
    const slots = [
      { col: 10, row: 10 },
      { col: 11, row: 9 },
      { col: 7, row: 13 },
    ];
    const atZero = slots.map(localHexPosition);
    const worldAtZero = slots.map((slot) => getWorldPositionForHex(slot));

    setWorldOrigin({ col: -2146912832, row: -2147482432 });

    expect(slots.map(localHexPosition)).toEqual(atZero);
    expect(slots.map((slot) => getWorldPositionForHex(slot))).not.toEqual(worldAtZero);
  });

  it("lays the local realm scene's ground under its buildings when the world origin moves", () => {
    setWorldOrigin({ col: -2146912832, row: -2147482432 });
    const slots = [
      { col: 10, row: 10 },
      { col: 11, row: 9 },
      { col: 7, row: 13 },
    ];
    const request = createHexceptionTerrainRequest(
      slots.map((slot) => ({
        ...slot,
        biome: BiomeType.Grassland,
        explored: true,
        occupied: false,
        previewBiome: BiomeType.Grassland,
      })),
      NEUTRAL_BIOME_CLIMATE,
      "hexception:test",
    );

    for (const slot of slots) {
      const cell = request.cells.find((entry) => {
        const ground = terrainHexToWorld(entry.col, entry.row);
        const building = localHexPosition(slot);
        return Math.abs(ground.x - building.x) < 1e-6 && Math.abs(ground.z - building.z) < 1e-6;
      });
      expect(cell).toBeDefined();
    }
  });
});
