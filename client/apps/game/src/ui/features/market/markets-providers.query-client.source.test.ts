import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("MarketsProviders query client defaults", () => {
  it("disables window-focus refetch storms for prediction market queries", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/market/markets-providers.tsx"), "utf8");

    expect(source).toContain("refetchOnWindowFocus: false");
    expect(source).toContain("retry: 1");
  });
});
