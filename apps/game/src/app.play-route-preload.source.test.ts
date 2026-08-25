// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("App play route preload wiring", () => {
  it("uses the primed game-route loader before the lazy play route mounts", () => {
    const source = readSource("src/game-client-app.tsx");

    expect(source).toContain("loadGameRouteForPlayEntry");
    expect(source).toContain("lazy(loadGameRouteForPlayEntry)");
    expect(source).not.toContain("<LoadingScreen prefetchPlayAssets />");
  });

  it("removes the later bootstrap-owned entry prime", () => {
    const source = readSource("src/game-entry/bootstrap-controller.ts");

    expect(source).not.toContain("primeGameEntry");
    expect(source).not.toContain('markGameEntryMilestone("asset-prefetch-scheduled")');
  });
});
