import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readHexagonSceneSource(): string {
  return readFileSync(resolve(currentDir, "hexagon-scene.ts"), "utf8");
}

function extractHandleMouseMove(source: string): string {
  const start = source.indexOf("private handleMouseMove");
  const end = source.indexOf("private handleDoubleClick", start);
  if (start === -1 || end === -1) {
    return "";
  }

  return source.slice(start, end);
}

describe("hexagon scene hover fallback", () => {
  it("uses the army raycast fallback for hover when hex picking misses", () => {
    const handleMouseMove = extractHandleMouseMove(readHexagonSceneSource());

    expect(handleMouseMove).toContain("const fallbackHex = this.tryArmyRaycastFallback(raycaster);");
    expect(handleMouseMove).toContain("getWorldPositionForHex(fallbackHex)");
    expect(handleMouseMove).toMatch(/this\.onHexagonMouseMove\(\{\s*hexCoords: fallbackHex,/);
  });

  it("derives a ground-plane hover hex before clearing hover state", () => {
    const source = readHexagonSceneSource();
    const handleMouseMove = extractHandleMouseMove(source);

    expect(handleMouseMove).toContain("const groundPlaneFallback = this.tryGroundPlaneHoverFallback(raycaster);");
    expect(handleMouseMove.indexOf("this.tryGroundPlaneHoverFallback(raycaster)")).toBeLessThan(
      handleMouseMove.indexOf("this.onHexagonMouseMove(null)"),
    );
    expect(source).toContain("private tryGroundPlaneHoverFallback(raycaster: Raycaster)");
    expect(source).toContain("getHexForWorldPosition");
  });
});
