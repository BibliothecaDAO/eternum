// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameLoadingOverlay source", () => {
  it("waits for the worldmap ready signal instead of the fixed post-map delay", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).toContain("waitForWorldmapSceneReady");
    expect(source).not.toContain("POST_WORLD_MAP_LOAD_DELAY_MS = 3_000");
  });
});
