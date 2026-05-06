import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readHexagonSceneSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const hexagonScenePath = resolve(currentDir, "hexagon-scene.ts");
  return readFileSync(hexagonScenePath, "utf8");
}

describe("hexagon scene frustum invalidation", () => {
  it("keeps controls change handling on a single frustum invalidation path", () => {
    const source = readHexagonSceneSource();
    const notifyControlsChangedStart = source.indexOf("private notifyControlsChanged()");
    const initializeSceneStart = source.indexOf("private initializeScene()", notifyControlsChangedStart);
    const methodSource =
      notifyControlsChangedStart >= 0 && initializeSceneStart > notifyControlsChangedStart
        ? source.slice(notifyControlsChangedStart, initializeSceneStart)
        : "";

    expect(methodSource).not.toMatch(/frustumManager\?\.(forceUpdate|markDirty)\s*\(/);
  });

  it("coalesces distance-driven outline opacity writes", () => {
    const source = readHexagonSceneSource();
    const outlineOpacitySource = source.slice(
      source.indexOf("protected updateOutlineOpacityForDistance"),
      source.indexOf("public setWeatherAtmosphereState"),
    );

    expect(source).toMatch(/OUTLINE_OPACITY_UPDATE_EPSILON/);
    expect(source).toMatch(/private lastOutlineOpacity/);
    expect(outlineOpacitySource).toMatch(
      /Math\.abs\(opacity - this\.lastOutlineOpacity\) < OUTLINE_OPACITY_UPDATE_EPSILON/,
    );
    expect(outlineOpacitySource).toMatch(/this\.lastOutlineOpacity = opacity/);
  });
});
