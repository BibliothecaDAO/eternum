import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const armyManagerPath = resolve(currentDir, "army-manager.ts");
  return readFileSync(armyManagerPath, "utf8");
}

describe("army manager owner-sync wiring", () => {
  it("wires existing-army tile updates through shared owner sync", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/private\s+syncTrackedArmyOwnerState\s*\(/);
    expect(source).toMatch(/this\.syncTrackedArmyOwnerState\s*\(\s*\{\s*entityId:\s*update\.entityId/);
  });
});
