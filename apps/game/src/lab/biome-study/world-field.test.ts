import { Biome, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";

import { buildContinuousLand } from "./land";
import { StudyField, type StudyCellInput } from "./world-field";

const CLIMATE: BiomeClimateConfig = {
  elevation_scale_bps: 10_000,
  moisture_scale_bps: 10_000,
  elevation_bias_bps: 10_000,
  moisture_bias_bps: 10_000,
  elevation_seed: 137,
  moisture_seed: 991,
};

/** Tiles as the game knows them: each biome is the contract's, from the tile's coordinates and the climate. */
function gameCells(
  fromCol: number,
  toCol: number,
  fromRow: number,
  toRow: number,
  climate = CLIMATE,
): StudyCellInput[] {
  const cells: StudyCellInput[] = [];
  for (let row = fromRow; row <= toRow; row++) {
    for (let col = fromCol; col <= toCol; col++) cells.push({ col, row, biome: Biome.getBiome(col, row, climate) });
  }
  return cells;
}

describe("the biome study's world field", () => {
  it("draws the same ground for the same seed and tiles", () => {
    const first = buildContinuousLand(new StudyField(gameCells(40, 52, 40, 50), CLIMATE), { level: 1, detail: 1 });
    const second = buildContinuousLand(new StudyField(gameCells(40, 52, 40, 50), CLIMATE), { level: 1, detail: 1 });

    expect(Array.from(second.ground.getAttribute("position").array)).toEqual(
      Array.from(first.ground.getAttribute("position").array),
    );
    expect(Array.from(second.ground.getAttribute("tint").array)).toEqual(
      Array.from(first.ground.getAttribute("tint").array),
    );
  });

  it("draws a tile's ground the same whether the map around it is revealed or not", () => {
    const revealed = new StudyField(gameCells(30, 60, 30, 60), CLIMATE);
    const partial = new StudyField(gameCells(42, 48, 42, 48), CLIMATE);
    const center = terrainHexToWorld(45, 45);
    const points = [
      [center.x, center.z],
      [center.x + 0.5, center.z - 0.3],
      [center.x - 0.8, center.z + 0.6],
      [center.x + 1.9, center.z + 1.2],
    ];

    for (const [x, z] of points) {
      const whole = revealed.sample(x, z);
      const part = partial.sample(x, z);
      expect(part.height).toBe(whole.height);
      expect(Array.from(part.families)).toEqual(Array.from(whole.families));
      expect(part.tint).toEqual(whole.tint);
    }
  });

  it("gives another game, with other climate seeds, other ground", () => {
    const climate = { ...CLIMATE, elevation_seed: 4242, moisture_seed: 77 };
    const ours = new StudyField(gameCells(42, 48, 42, 48), CLIMATE);
    const theirs = new StudyField(gameCells(42, 48, 42, 48, climate), climate);
    const center = terrainHexToWorld(45, 45);

    expect(theirs.sample(center.x + 0.6, center.z).height).not.toBe(ours.sample(center.x + 0.6, center.z).height);
  });

  it("keeps every tile's biome and elevation exactly as the contract decides them", () => {
    const field = new StudyField(gameCells(0, 40, 0, 40), CLIMATE);

    for (const cell of field.allCells()) {
      const contract = Biome.sampleEnvironment(cell.col, cell.row, CLIMATE);
      expect(cell.biome).toBe(contract.biome);
      expect(cell.elevation).toBe(contract.elevation);
    }
  });

  it("stands every tile's centre on level ground for its army or building", () => {
    const field = new StudyField(gameCells(42, 48, 42, 48), CLIMATE);
    const center = terrainHexToWorld(45, 45);
    const heights = [
      [0, 0],
      [0.2, 0],
      [-0.15, 0.2],
      [0, -0.25],
    ].map(([dx, dz]) => field.sample(center.x + dx, center.z + dz).height);

    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.002);
  });
});
