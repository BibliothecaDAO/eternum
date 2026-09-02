import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Blitz prize settlement queries", () => {
  it("reads the settled roster from the world slice instead of an empty query fallback", () => {
    const prizeSources = [readSource("src/ui/features/prize/prize-panel.tsx")];

    prizeSources.forEach((source) => {
      expect(source).toContain("useWorldSlicesStore((state) => state.blitzSettlementPlayers)");
      expect(source).not.toContain("resolveBlitzSettlementComponent");
      expect(source).not.toContain("useEntityQuery(blitzSettlementComponent ? [Has(blitzSettlementComponent)] : [])");
      expect(source).not.toContain("? [Has(blitzSettlementComponent)] : []");
    });
  });
});
