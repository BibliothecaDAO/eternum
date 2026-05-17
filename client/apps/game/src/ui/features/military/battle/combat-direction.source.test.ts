import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Combat modal paired-layer attack direction", () => {
  it("passes the direction hex from CombatModal into AttackContainer", () => {
    const source = readSource("combat-modal.tsx");

    expect(source).toContain("directionHex?: { x: number; y: number };");
    expect(source).toContain("targetDirectionHex={target.directionHex}");
  });

  it("passes the direction hex from AttackContainer into CombatContainer", () => {
    const source = readSource("attack-container.tsx");

    expect(source).toContain("targetDirectionHex?: { x: number; y: number };");
    expect(source).toContain("directionHex={targetDirectionHex}");
  });

  it("uses the direction hex for detailed attack direction calculations", () => {
    const source = readSource("combat-container.tsx");

    expect(source).toContain("directionHex?: { x: number; y: number };");
    expect(source).toContain("const attackDirectionHex = directionHex ?? target.hex;");
    expect(source).toContain("getDirectionBetweenAdjacentHexes(selectedHex");
    expect(source).toContain("attackDirectionHex.x");
    expect(source).toContain("attackDirectionHex.y");
  });
});
