import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "./structure-manager.ts"), "utf8");

describe("structure instance capacity (L5 item 7)", () => {
  it("refuses an overflowing slot loudly instead of throwing out of the visible-structure pass", () => {
    expect(source).not.toMatch(/throw new Error\(`Structure instance capacity/);
    expect(source).toContain('incrementWorldmapRenderCounter("structureInstanceCapacityOverflow")');
  });

  it("sizes the fixed capacity from the game's structure cap, not the 512 guess", () => {
    const capacity = Number(source.match(/const STRUCTURE_INSTANCE_CAPACITY = (\d+);/)?.[1]);
    expect(capacity).toBeGreaterThanOrEqual(1024);
  });
});
