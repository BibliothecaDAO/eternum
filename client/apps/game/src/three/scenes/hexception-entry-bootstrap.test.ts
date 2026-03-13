import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Hexception entry bootstrap", () => {
  it("keeps the initial setup call in the constructor for loading-overlay handoff", () => {
    const source = readFileSync(new URL("./hexception.tsx", import.meta.url), "utf8");

    expect(source).toMatch(/this\.tileManager = new TileManager[\s\S]*this\.setup\(\);[\s\S]*this\.inputManager\.addListener/);
  });
});
