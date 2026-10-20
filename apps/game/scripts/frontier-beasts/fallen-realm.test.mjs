import { it, expect } from "vitest";
import { StructureType } from "@bibliothecadao/types";
import { FALLEN_REALM_DEPTHS, FALLEN_REALM_RUIN_PATH, frontierBeast } from "../../src/three/structures/frontier-beast";
import { measureBeastPlacement } from "../frontier/verify-beast-placement.mjs";

for (const [depth, { beast, scale }] of FALLEN_REALM_DEPTHS.entries()) {
  it(`depth ${depth}: ${beast} clears the ruin masonry at runtime scale ${scale}`, async () => {
    const ruinPath = new URL(`../../public${FALLEN_REALM_RUIN_PATH}`, import.meta.url).pathname;
    const result = await measureBeastPlacement(beast, scale, ruinPath);
    console.log(JSON.stringify({ depth, ...result }));
    expect(result.fitsTile).toBe(true);
    expect(result.masonryContacts).toBe(0);
    expect(result.passed).toBe(true);
  });
}

for (const band of ["lowly", "stronger"]) {
  it(`${band} roaming beast fits its tile with no structure`, async () => {
    const { beast, scale } = frontierBeast(0, StructureType.Beasts, band);
    const result = await measureBeastPlacement(beast, scale);
    console.log(JSON.stringify({ band, ...result }));
    expect(result.fitsTile).toBe(true);
    expect(result.masonryContacts).toBe(0);
    expect(result.passed).toBe(true);
  });
}
