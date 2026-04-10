// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap initial refresh", () => {
  it("fails closed when the first visible chunk refresh does not commit a chunk", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("const didRefresh = await this.updateVisibleChunks(true);");
    expect(source).toContain('throw new Error("World map did not finish its initial interactive refresh.");');
  });
});
