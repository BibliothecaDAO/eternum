// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("TileManager construction resource overrides", () => {
  it("does not apply construction resource deductions outside construction intents", () => {
    const source = readSource("src/managers/tile-manager.ts");
    const optimisticBuilding = source.match(/private _optimisticBuilding[\s\S]*?private _optimisticDestroy/)?.[0] ?? "";

    expect(optimisticBuilding).not.toContain("optimisticResourceUpdate");
    expect(optimisticBuilding).not.toContain("_overrideResource");
  });
});
