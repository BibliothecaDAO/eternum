import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "game-renderer.ts"), "utf8");
}

describe("GameRenderer prewarm hook", () => {
  it("requests async scene prewarm for the primary scene surfaces during setup", () => {
    const source = readSource();

    expect(source).toMatch(/requestRendererScenePrewarm/);
    expect(source).toMatch(/this\.requestScenePrewarm\(this\.worldmapScene\)/);
    expect(source).toMatch(/this\.requestScenePrewarm\(this\.hexceptionScene\)/);
  });
});
