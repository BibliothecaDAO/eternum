import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readArmyManagerSource = (): string => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
};

describe("army manager cosmetics refresh wiring", () => {
  it("exposes an owner-scoped cosmetic refresh entry point", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/public\s+refreshCosmeticsForOwner\s*\(\s*owner:\s*string\s*\|\s*bigint\s*\)/);
    expect(source).toMatch(/this\.refreshArmyInstance\s*\(\s*army,\s*slot,\s*assignedModelType,\s*true\s*\)/);
  });
});
