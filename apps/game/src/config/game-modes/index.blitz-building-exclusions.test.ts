import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readGameModeSource = () => readFileSync(resolve(process.cwd(), "src/config/game-modes/index.ts"), "utf8");

describe("Blitz building exclusions", () => {
  it("keeps research lab out of blitz construction options", () => {
    const source = readGameModeSource();

    expect(source).toContain(
      'const BLITZ_BUILDING_EXCLUSIONS = new Set<string>(["ResourceFish", "ResourceResearch"]);',
    );
  });
});
