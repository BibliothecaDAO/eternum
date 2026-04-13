// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("worldmap startup hydrated refresh", () => {
  it("queues one hydrated refresh after the first cold-boot chunk commit", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain('if (oldChunk === "null") {');
    expect(source).toContain("this.scheduleHydratedChunkRefresh(chunkKey);");
  });
});
