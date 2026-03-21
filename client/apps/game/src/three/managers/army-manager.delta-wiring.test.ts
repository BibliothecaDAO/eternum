import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("army manager delta pipeline wiring", () => {
  it("stops using quadratic visible-order array membership and removal operations", () => {
    const source = readArmyManagerSource();

    expect(source).not.toMatch(/visibleArmyOrder\.includes/);
    expect(source).not.toMatch(/visibleArmyOrder\.indexOf/);
    expect(source).toMatch(/visibleArmyOrderIndices/);
    expect(source).toMatch(/addVisibleArmyOrderEntry/);
    expect(source).toMatch(/removeVisibleArmyOrderEntry/);
    expect(source).toMatch(/replaceVisibleArmyOrder/);
  });

  it("patches visible adds and ownership changes without routing through full visible rerenders", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/await this\.renderArmyIntoCurrentChunkIfVisible\(params\.entityId\)/);
    expect(source).not.toMatch(/await this\.renderVisibleArmies\(this\.currentChunkKey\)/);
    expect(source).toMatch(/slot !== undefined[\s\S]*this\.refreshArmyInstance\(army, slot, modelType\)/);
  });
});
