// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameLoadingOverlay source", () => {
  it("uses the fixed post-map delay instead of the hexception grid-ready signal", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).not.toContain("waitForHexceptionGridReady");
    expect(source).toContain("POST_WORLD_MAP_LOAD_DELAY_MS = 3_000");
    expect(source).toContain("markWorldMapReady(POST_WORLD_MAP_LOAD_DELAY_MS)");
  });
});
