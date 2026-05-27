// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap URL-location refresh wiring", () => {
  it("allows initial setup to move to the URL target without owning terrain refresh", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodStart = source.indexOf("public moveCameraToURLLocation(");
    const alignStart = source.indexOf("private alignInitialWorldmapCameraView()");
    const lifecycleStart = source.indexOf("protected getWarpTravelLifecycleAdapter()");
    const lifecycleEnd = source.indexOf("private announceWorldmapSceneReady()", lifecycleStart);

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(alignStart).toBeGreaterThan(methodStart);
    expect(lifecycleStart).toBeGreaterThanOrEqual(0);
    expect(lifecycleEnd).toBeGreaterThan(lifecycleStart);

    const methodBody = source.slice(methodStart, alignStart);
    const lifecycleBody = source.slice(lifecycleStart, lifecycleEnd);

    expect(methodBody).toContain("this.moveCameraToColRow(col, row, 0);");
    expect(methodBody).toContain('this.requestChunkRefresh(true, "default");');
    expect(methodBody).toContain("requestRefresh");
    expect(lifecycleBody).toContain("this.moveCameraToURLLocation({ requestRefresh: false })");
  });
});
