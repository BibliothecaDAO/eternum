// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap URL-location refresh wiring", () => {
  it("forces a chunk refresh after moving the camera to the URL target", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodStart = source.indexOf("public moveCameraToURLLocation()");
    const alignStart = source.indexOf("private alignInitialWorldmapCameraView()");

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(alignStart).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, alignStart);

    expect(methodBody).toContain("this.moveCameraToColRow(col, row, 0);");
    expect(methodBody).toContain('this.requestChunkRefresh(true, "default");');
  });
});
