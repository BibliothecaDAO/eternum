// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("toggleMapHexView canonical routing", () => {
  it("builds the toggled URL from the canonical play route when one is active", () => {
    const source = readSource("src/three/utils/navigation.ts");

    expect(source).toContain("const playRoute = parsePlayRoute(window.location);");
    expect(source).toContain("return buildPlayHref({");
    expect(source).toContain('scene: currentPath.includes("/hex") ? "map" : "hex",');
  });
});
