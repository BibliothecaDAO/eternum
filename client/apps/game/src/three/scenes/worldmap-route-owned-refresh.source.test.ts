// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap route-owned refresh", () => {
  it("reasserts canonical map routes after the blank overlay dismisses", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("private bindRouteOwnedRefreshLifecycle(): void {");
    expect(source).toContain("(state) => state.showBlankOverlay");
    expect(source).toContain("const playRoute = parsePlayRoute(window.location);");
    expect(source).toContain('if (playRoute?.scene !== "map" || playRoute.col === null || playRoute.row === null) {');
    expect(source).toContain("this.moveCameraToURLLocation();");
    expect(source).toContain('this.requestChunkRefresh(true, "default");');
  });
});
