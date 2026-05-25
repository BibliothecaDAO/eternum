// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("worldmap late terrain recovery", () => {
  it("uses current render bounds instead of frustum point visibility for late-tile terrain repair", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodStart = source.indexOf("  public async updateExploredHex(update: TileSystemUpdate) {");
    const methodEnd = source.indexOf("  isColRowInVisibleChunk(col: number, row: number) {", methodStart);
    const methodBody = source.slice(methodStart, methodEnd);

    expect(methodBody).toContain("this.isColRowInCurrentRenderBounds(col, row)");
    expect(methodBody).not.toContain("this.isColRowInVisibleChunk(col, row)");
  });
});
