// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const liveStateConsumers = [
  "src/ui/features/world/components/entities/hooks/use-army-entity-detail.ts",
  "src/ui/features/military/battle/hooks/use-attack-target.ts",
  "src/ui/features/military/components/transfer-resources-container.tsx",
  "src/ui/features/military/components/transfer-troops-container.tsx",
];

describe("live client state ownership", () => {
  it("keeps army, battle-preview, and transfer facts in RECS", () => {
    const explorerBypass = ["getExplorer", "FromToriiClient"].join("");
    const structureBypass = ["getStructure", "FromToriiClient"].join("");
    liveStateConsumers.forEach((path) => {
      const source = readSource(path);
      expect(source).not.toContain(explorerBypass);
      expect(source).not.toContain(structureBypass);
      expect(source).toContain("useGameEntityComponentValue");
    });
  });

  it("re-checks transfer calldata against live limits", () => {
    const resources = readSource("src/ui/features/military/components/transfer-resources-container.tsx");
    const troops = readSource("src/ui/features/military/components/transfer-troops-container.tsx");

    expect(resources).toContain("Math.min(requestedAmount, divideByPrecision(current.amount), capacityLimit)");
    expect(troops).toContain("multiplyByPrecision(effectiveTroopAmount)");
  });

  it("keeps Torii entity reads inside the sync adapter", () => {
    expect(readSource("src/dojo/queries.ts")).not.toContain(".getEntities(");
    expect(readSource("src/dojo/gamewide-sync-adapter.ts")).toContain(".getEntities(");
  });
});
