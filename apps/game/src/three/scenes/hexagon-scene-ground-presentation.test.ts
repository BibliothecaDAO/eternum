import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readHexagonSceneSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "hexagon-scene.ts"), "utf8");
}

describe("hexagon scene ground presentation", () => {
  it("renders the world ground without the paper texture backdrop", () => {
    const source = readHexagonSceneSource();

    expect(source).not.toMatch(/worldmap-bg-blitz\.png/);
    expect(source).not.toMatch(/map:\s*texture/);
  });
});
