import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("combat guidance", () => {
  it("documents that ranged structure attacks clear guards without claiming", () => {
    const overlaySource = readFileSync(resolve(__dirname, "../../src/abi/domain-overlay.ts"), "utf-8");
    const combatTaskGuide = readFileSync(resolve(__dirname, "../../data/tasks/combat.md"), "utf-8");

    expect(overlaySource).toContain("ranged Crossbowman attacks can clear guards");
    expect(overlaySource).toContain("only adjacent explorer attacks can claim");
    expect(combatTaskGuide).toContain("ranged attacks can clear guards");
    expect(combatTaskGuide).toMatch(/only adjacent attacks\s+claim structures/);
  });
});
