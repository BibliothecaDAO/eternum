import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readGameRendererSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const rendererPath = resolve(currentDir, "game-renderer.ts");
  return readFileSync(rendererPath, "utf8");
}

describe("GameRenderer fast-travel bootstrap", () => {
  it("registers a concrete fast-travel scene with the scene manager only when enabled", () => {
    const source = readGameRendererSource();

    expect(source).toMatch(/import FastTravelScene from ["']@\/three\/scenes\/fast-travel["']/);
    expect(source).toMatch(/private fastTravelScene\?: FastTravelScene;/);
    expect(source).toMatch(/private isFastTravelEnabled\(\): boolean/);
    expect(source).toMatch(/if \(this\.isFastTravelEnabled\(\)\)/);
    expect(source).toMatch(/this\.fastTravelScene = new FastTravelScene\(/);
    expect(source).toMatch(/this\.sceneManager\.addScene\(SceneName\.FastTravel, this\.fastTravelScene\)/);
  });

  it("routes URL scene resolution through the navigation boundary with fast-travel gating", () => {
    const source = readGameRendererSource();

    expect(source).toMatch(/resolveNavigationSceneTarget/);
    expect(source).toMatch(/const fastTravelEnabled = this\.isFastTravelEnabled\(\);/);
    expect(source).toMatch(/requestedScene:\s*resolveSceneNameFromRouteSegment\(sceneSlug\)/);
    expect(source).toMatch(/fastTravelEnabled,/);
  });

  it("updates and renders the fast-travel scene only when present and active", () => {
    const source = readGameRendererSource();

    expect(source).toMatch(/this\.fastTravelScene\?\.setWeatherAtmosphereState\(weatherState\)/);
    expect(source).toMatch(
      /const isFastTravel = this\.sceneManager\?\.getCurrentScene\(\) === SceneName\.FastTravel && Boolean\(this\.fastTravelScene\)/,
    );
    expect(source).toMatch(/this\.fastTravelScene\?\.getScene\(\)/);
  });
});
