import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("army visible set reconciler wiring", () => {
  it("routes render reconciliation through a named helper", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/this\.reconcileVisibleArmies\(visibleArmies, modelTypesByEntity, options\?\.force\)/);
    expect(source).toMatch(/private reconcileVisibleArmies\(/);
  });
});
