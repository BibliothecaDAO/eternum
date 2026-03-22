// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useClaimablePayout fallback source", () => {
  it("loads condition resolution from SQL when market object is missing payout numerators", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pm/hooks/markets/use-claimable-payout.ts"), "utf8");

    expect(source).toContain("fetchConditionResolutionByKeys");
    expect(source).toContain("payoutNumerators");
  });
});
