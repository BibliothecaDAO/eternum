// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap initial refresh", () => {
  it("joins an active transition and still fails closed when no chunk commits", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("const didRefresh = await this.refreshVisibleChunksForWarpTravel();");
    expect(source).toMatch(
      /private async refreshVisibleChunksForWarpTravel\(\): Promise<boolean> \{[\s\S]*waitForChunkTransitionToSettle/,
    );
    expect(source).toContain('throw new Error("World map did not finish its initial interactive refresh.");');
  });
});
