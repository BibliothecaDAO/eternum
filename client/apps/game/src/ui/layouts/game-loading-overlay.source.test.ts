// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameLoadingOverlay source", () => {
  it("waits for the grid-ready signal instead of the fixed post-load timeout", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).toContain("waitForHexceptionGridReady");
    expect(source).not.toContain("POST_WORLD_MAP_LOAD_DELAY_MS = 3_000");
    expect(source).not.toContain("dismiss(POST_WORLD_MAP_LOAD_DELAY_MS)");
  });
});
