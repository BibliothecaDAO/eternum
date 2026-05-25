import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView learn-tab hierarchy", () => {
  it("pins a start-here card and exposes explicit guide freshness fields", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");

    expect(source).toContain("New? Start Here");
    expect(source).toContain("verifiedAt");
    expect(source).toContain("deprecated");
  });

  it("renders beginner and advanced guide tiers ahead of practice games", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const beginnerIndex = source.indexOf("Beginner");
    const advancedIndex = source.indexOf("Advanced");
    const practiceIndex = source.indexOf("Practice Games");

    expect(beginnerIndex).toBeGreaterThan(-1);
    expect(advancedIndex).toBeGreaterThan(beginnerIndex);
    expect(practiceIndex).toBeGreaterThan(advancedIndex);
  });
});
