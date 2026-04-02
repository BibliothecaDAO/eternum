// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("App play route preload wiring", () => {
  it("uses the shared game-route preloader and stops waiting for the loading screen to start asset prefetch", () => {
    const source = readSource("src/app.tsx");

    expect(source).toContain("preloadGameRouteModule");
    expect(source).toContain("lazy(preloadGameRouteModule)");
    expect(source).not.toContain("<LoadingScreen prefetchPlayAssets />");
  });
});
