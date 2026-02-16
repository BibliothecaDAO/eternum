import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("policies dynamic world tokens", () => {
  it("derives active-world token addresses inside buildPolicies instead of module scope", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/policies.ts"), "utf8");
    const buildPoliciesStart = source.indexOf("export const buildPolicies");

    expect(buildPoliciesStart).toBeGreaterThan(-1);

    const moduleScope = source.slice(0, buildPoliciesStart);
    const buildPoliciesBlock = source.slice(buildPoliciesStart, buildPoliciesStart + 1500);

    expect(moduleScope).not.toContain("const activeWorld = getActiveWorld()");
    expect(moduleScope).not.toContain("const entryTokenAddress");
    expect(moduleScope).not.toContain("const feeTokenAddress");

    expect(buildPoliciesBlock).toContain("const activeWorld = getActiveWorld()");
    expect(buildPoliciesBlock).toContain("const entryTokenAddress");
    expect(buildPoliciesBlock).toContain("const feeTokenAddress");
  });
});
