import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: {
    getState: () => ({
      account: { address: "0" },
    }),
  },
}));

vi.mock("three-stdlib", () => ({
  DRACOLoader: class {
    setDecoderPath() {}
    preload() {}
  },
  GLTFLoader: class {
    setDRACOLoader() {}
    setMeshoptDecoder() {}
  },
  MeshoptDecoder: () => ({}),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  calculateDistance: () => 0,
}));

vi.mock("@bibliothecadao/types", () => ({
  ContractAddress: (value: string) => value,
}));

vi.mock("../constants", () => ({
  HEX_SIZE: 1,
}));

import { getHexForWorldPosition, getWorldPositionForHex } from "./utils";

function findNearestHexByCenter(x: number, z: number, radius: number = 8): { col: number; row: number } {
  let bestCol = 0;
  let bestRow = 0;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let row = -radius; row <= radius; row += 1) {
    for (let col = -radius; col <= radius; col += 1) {
      const center = getWorldPositionForHex({ col, row });
      const dx = x - center.x;
      const dz = z - center.z;
      const distanceSq = dx * dx + dz * dz;

      if (
        distanceSq < bestDistanceSq - 1e-12 ||
        (Math.abs(distanceSq - bestDistanceSq) <= 1e-12 && (row < bestRow || (row === bestRow && col < bestCol)))
      ) {
        bestDistanceSq = distanceSq;
        bestCol = col;
        bestRow = row;
      }
    }
  }

  return { col: bestCol, row: bestRow };
}

function normalizeHex(hex: { col: number; row: number }): { col: number; row: number } {
  return {
    col: Object.is(hex.col, -0) ? 0 : hex.col,
    row: Object.is(hex.row, -0) ? 0 : hex.row,
  };
}

function findNearestHexByCenterInWindow(
  x: number,
  z: number,
  center: { col: number; row: number },
  radius: number = 3,
): { col: number; row: number } {
  let bestCol = center.col;
  let bestRow = center.row;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let row = center.row - radius; row <= center.row + radius; row += 1) {
    for (let col = center.col - radius; col <= center.col + radius; col += 1) {
      const hexCenter = getWorldPositionForHex({ col, row });
      const dx = x - hexCenter.x;
      const dz = z - hexCenter.z;
      const distanceSq = dx * dx + dz * dz;

      if (
        distanceSq < bestDistanceSq - 1e-12 ||
        (Math.abs(distanceSq - bestDistanceSq) <= 1e-12 && (row < bestRow || (row === bestRow && col < bestCol)))
      ) {
        bestDistanceSq = distanceSq;
        bestCol = col;
        bestRow = row;
      }
    }
  }

  return { col: bestCol, row: bestRow };
}

function circumcenter(
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number },
): { x: number; z: number } {
  const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
  const ux =
    ((a.x * a.x + a.z * a.z) * (b.z - c.z) +
      (b.x * b.x + b.z * b.z) * (c.z - a.z) +
      (c.x * c.x + c.z * c.z) * (a.z - b.z)) /
    d;
  const uz =
    ((a.x * a.x + a.z * a.z) * (c.x - b.x) +
      (b.x * b.x + b.z * b.z) * (a.x - c.x) +
      (c.x * c.x + c.z * c.z) * (b.x - a.x)) /
    d;
  return { x: ux, z: uz };
}

describe("getHexForWorldPosition nearest-hex contract", () => {
  it("matches nearest-center expectation on boundary and corner samples", () => {
    const samples = [
      { x: 0.86, z: 0.51 },
      { x: -0.86, z: -2.48 },
      { x: 2.6, z: 0.51 },
      { x: -2.6, z: -2.48 },
    ];

    samples.forEach((sample) => {
      const expected = normalizeHex(findNearestHexByCenter(sample.x, sample.z));
      const actual = normalizeHex(getHexForWorldPosition({ x: sample.x, y: 0, z: sample.z }));
      expect(actual).toEqual(expected);
    });
  });

  it("keeps round-trip stability for sampled interior offsets", () => {
    const localOffsets = [
      { x: 0, z: 0 },
      { x: 0.2, z: 0.15 },
      { x: -0.22, z: 0.1 },
      { x: 0.18, z: -0.2 },
      { x: -0.16, z: -0.18 },
    ];

    for (let row = -4; row <= 4; row += 1) {
      for (let col = -4; col <= 4; col += 1) {
        const center = getWorldPositionForHex({ col, row });
        localOffsets.forEach((offset) => {
          const worldX = center.x + offset.x;
          const worldZ = center.z + offset.z;
          const expected = normalizeHex(findNearestHexByCenter(worldX, worldZ, 10));
          const actual = normalizeHex(getHexForWorldPosition({ x: worldX, y: 0, z: worldZ }));
          expect(actual).toEqual(expected);
        });
      }
    }
  });

  it("keeps deterministic tie-break behavior at exact boundaries and corners", () => {
    const base = { col: 0, row: 0 };
    const center = getWorldPositionForHex(base);
    const east = getWorldPositionForHex({ col: 1, row: 0 });
    const southEast = getWorldPositionForHex({ col: 1, row: 1 });

    const midpoint = {
      x: (center.x + east.x) / 2,
      z: (center.z + east.z) / 2,
    };
    expect(normalizeHex(getHexForWorldPosition({ x: midpoint.x, y: 0, z: midpoint.z }))).toEqual({ col: 0, row: 0 });

    const corner = circumcenter(
      { x: center.x, z: center.z },
      { x: east.x, z: east.z },
      { x: southEast.x, z: southEast.z },
    );
    expect(normalizeHex(getHexForWorldPosition({ x: corner.x, y: 0, z: corner.z }))).toEqual({ col: 0, row: 0 });
  });

  it("remains stable at large coordinate magnitudes", () => {
    const base = { col: 1_000_000, row: -1_000_000 };
    const center = getWorldPositionForHex(base);
    const sample = { x: center.x + 0.86, z: center.z + 0.51 };
    const expected = normalizeHex(findNearestHexByCenterInWindow(sample.x, sample.z, base, 3));
    const actual = normalizeHex(getHexForWorldPosition({ x: sample.x, y: 0, z: sample.z }));
    expect(actual).toEqual(expected);

    const east = getWorldPositionForHex({ col: base.col + 1, row: base.row });
    const midpoint = {
      x: (center.x + east.x) / 2,
      z: (center.z + east.z) / 2,
    };
    const expectedMidpoint = normalizeHex(findNearestHexByCenterInWindow(midpoint.x, midpoint.z, base, 3));
    for (let i = 0; i < 10; i += 1) {
      const midpointActual = normalizeHex(getHexForWorldPosition({ x: midpoint.x, y: 0, z: midpoint.z }));
      expect(midpointActual).toEqual(expectedMidpoint);
    }
  });
});
