// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PlayView entry preloading", () => {
  it("preloads only the game route chunk before navigating into the route-owned entry flow", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).toContain("primeGameEntry");
    expect(source).toContain("buildEntryHrefFromEntryContext");
    expect(source).toContain('openGameEntryRoute(selection, "play", false)');
    expect(source).toContain('primeGameEntry("entry");');
    expect(source).not.toContain("primePlayEntryResources();");
  });
});
