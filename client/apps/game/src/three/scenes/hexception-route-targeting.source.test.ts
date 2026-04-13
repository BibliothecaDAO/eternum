// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Hexception route targeting", () => {
  it("anchors the local-view camera on the center keep tile instead of the outer world route coordinates", () => {
    const source = readSource("src/three/scenes/hexception.tsx");
    const methodStart = source.indexOf("public moveCameraToURLLocation()");
    const nextMethodStart = source.indexOf("updateCastleLevel()", methodStart);

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(nextMethodStart).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, nextMethodStart);

    expect(methodBody).toContain("this.moveCameraToColRow(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1], 0);");
    expect(methodBody).not.toContain("this.moveCameraToColRow(10, 10, 0);");
  });
});
