import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Hexception entry bootstrap", () => {
  it("keeps the initial setup call in the constructor for loading-overlay handoff", () => {
    const source = readFileSync(new URL("./hexception.tsx", import.meta.url), "utf8");

    expect(source).toMatch(
      /this\.tileManager = new TileManager[\s\S]*void this\.setup\(\)\.catch[\s\S]*this\.inputManager\.addListener/,
    );
  });

  it("finishes the latest grid and queued texture preparation before scene activation", () => {
    const source = readFileSync(new URL("./hexception.tsx", import.meta.url), "utf8");

    expect(source).toMatch(/await this\.latestGridCommit;\s+await this\.prepareFirstRenderTextures\(\);/);
    expect(source).toContain('owner: "scene:hexception:texture-upload"');
  });
});
