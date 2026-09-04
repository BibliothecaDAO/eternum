// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("CraftRelicPopup source", () => {
  it("keeps the research balance authoritative while the button owns pending state", () => {
    const source = readSource("src/ui/features/economy/resources/craft-relic-popup.tsx");

    expect(source).toContain("await systemCalls.burn_research_for_relic");
    expect(source).not.toContain("Provisional");
    expect(source).toContain("displayedResearchBalance");
    expect(source).not.toContain("optimisticResearchBalance");
    expect(source).not.toContain("setOptimisticResearchBalance");
    expect(source).toContain("Math.max(displayedResearchBalance - configuredResearchCost, 0)");
  });
});
