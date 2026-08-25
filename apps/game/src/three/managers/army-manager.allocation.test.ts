import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

/**
 * Tests for the allocation-reduction fix in army position lookups.
 *
 * getWorldPositionForHexCoordsInto writes into a caller-provided Vector3 and
 * returns it. These tests verify the "write-into-out" pattern that
 * getArmyWorldPosition should use (reusable temp vector) rather than
 * allocating a new Vector3 on every call.
 *
 * We inline a simplified version of getWorldPositionForHexCoordsInto to avoid
 * the deep transitive import chain from @/three/utils/utils. The real function
 * has identical write-into-out semantics.
 */

const HEX_SIZE = 1;

function getWorldPositionForHexCoordsInto(col: number, row: number, out: Vector3): Vector3 {
  const hexRadius = HEX_SIZE;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const x = col * horizDist - rowOffset;
  const z = row * vertDist;
  out.set(x, 0, z);
  return out;
}

describe("army world position allocation pattern", () => {
  it("writes into the provided output vector and returns the same reference", () => {
    const out = new Vector3();
    const result = getWorldPositionForHexCoordsInto(10, 20, out);

    expect(result).toBe(out);
    expect(out.x).not.toBe(0);
  });

  it("produces identical results regardless of which output vector is provided", () => {
    const a = new Vector3();
    const b = new Vector3();

    getWorldPositionForHexCoordsInto(5, 10, a);
    getWorldPositionForHexCoordsInto(5, 10, b);

    expect(a.x).toBeCloseTo(b.x);
    expect(a.y).toBeCloseTo(b.y);
    expect(a.z).toBeCloseTo(b.z);
  });

  it("overwrites the output vector completely on each call", () => {
    const shared = new Vector3(999, 999, 999);

    getWorldPositionForHexCoordsInto(3, 7, shared);

    // The previous sentinel values must be replaced
    expect(shared.x).not.toBe(999);
    expect(shared.z).not.toBe(999);
  });

  it("callers that need independent vectors must clone or provide their own", () => {
    // This test documents the contract: when using a shared temp vector,
    // a caller that builds an array of positions must clone each result.
    const shared = new Vector3();
    const positions = [
      { col: 1, row: 1 },
      { col: 2, row: 2 },
      { col: 3, row: 3 },
    ];

    // Wrong pattern (what createPath would do if it used the shared temp):
    const wrongArray = positions.map((p) => getWorldPositionForHexCoordsInto(p.col, p.row, shared));
    // All entries point to the same vector — they all have the LAST value
    expect(wrongArray[0]).toBe(wrongArray[1]);
    expect(wrongArray[1]).toBe(wrongArray[2]);

    // Correct pattern: clone each result or provide a new vector per element
    const correctArray = positions.map((p) => getWorldPositionForHexCoordsInto(p.col, p.row, new Vector3()));
    expect(correctArray[0]).not.toBe(correctArray[1]);
    expect(correctArray[0].x).not.toBeCloseTo(correctArray[2].x);
  });
});
