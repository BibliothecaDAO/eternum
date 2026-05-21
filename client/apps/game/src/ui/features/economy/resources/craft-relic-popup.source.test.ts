// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("CraftRelicPopup source", () => {
  it("keeps a successful research burn reflected until live resource sync catches up", () => {
    const source = readSource("src/ui/features/economy/resources/craft-relic-popup.tsx");

    expect(source).toContain("optimisticResearchBalance");
    expect(source).toContain("setOptimisticResearchBalance");
    expect(source).toContain("displayedResearchBalance");
    expect(source).toContain("Math.max(displayedResearchBalance - configuredResearchCost, 0)");
  });
});
