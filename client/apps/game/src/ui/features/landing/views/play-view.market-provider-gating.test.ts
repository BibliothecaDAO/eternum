import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView market provider gating", () => {
  it("mounts prediction-market providers only for the play tab", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");

    expect(source).toContain('const shouldMountMarketsProviders = activeTab === "play"');
    expect(source).toContain("shouldMountMarketsProviders ? <MarketsProviders>{content}</MarketsProviders> : content");
  });
});
