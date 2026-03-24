// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Landing dashboard AMM entry", () => {
  it("adds an AMM section to the main dashboard sidebar and mobile drawer", () => {
    const navigationSource = readSource("src/ui/features/landing/context/navigation-config.ts");
    const headerSource = readSource("src/ui/features/landing/components/landing-header.tsx");

    expect(navigationSource).toContain('type SectionId = "home" | "leaderboard" | "markets" | "amm" | "profile"');
    expect(navigationSource).toContain('id: "amm"');
    expect(navigationSource).toContain('label: "AMM"');
    expect(navigationSource).toContain('basePath: "/amm"');
    expect(headerSource).toContain("{ icon:");
    expect(headerSource).toContain('label: "AMM"');
    expect(headerSource).toContain('path: "/amm"');
  });
});
