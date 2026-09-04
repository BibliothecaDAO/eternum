import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("landing mode hero", () => {
  it("does not render the misleading no-op Enter Blitz affordance", () => {
    const source = readFileSync("src/ui/features/landing/views/play-view.tsx", "utf8");
    expect(source).not.toContain('"Enter Blitz"');
    expect(source).not.toContain('"Enter Campaigns"');
  });
});
