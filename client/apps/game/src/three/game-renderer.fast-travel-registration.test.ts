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
  it("registers a concrete fast-travel scene with the scene manager", () => {
    const source = readGameRendererSource();

    expect(source).toMatch(/import FastTravelScene from ["']@\/three\/scenes\/fast-travel["']/);
    expect(source).toMatch(/private fastTravelScene!: FastTravelScene;/);
    expect(source).toMatch(/this\.fastTravelScene = new FastTravelScene\(/);
    expect(source).toMatch(/this\.sceneManager\.addScene\(SceneName\.FastTravel, this\.fastTravelScene\)/);
  });

  it("routes URL scene resolution through the navigation boundary", () => {
    const source = readGameRendererSource();

    expect(source).toMatch(/resolveNavigationSceneTarget/);
    expect(source).toMatch(/requestedScene:\s*resolveSceneNameFromRouteSegment\(sceneSlug\)/);
  });

  it("updates and renders the fast-travel scene when it is active", () => {
    const source = readGameRendererSource();

    expect(source).toMatch(/this\.fastTravelScene\.setWeatherAtmosphereState\(weatherState\)/);
    expect(source).toMatch(/const isFastTravel = this\.sceneManager\?\.getCurrentScene\(\) === SceneName\.FastTravel/);
    expect(source).toMatch(/this\.fastTravelScene\.update\(deltaTime\)/);
    expect(source).toMatch(/isFastTravel\s*\?\s*this\.fastTravelScene\.getScene\(\)/);
  });
});
