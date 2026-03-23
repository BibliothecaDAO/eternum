// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("AMM feature wiring", () => {
  it("resolves runtime config from env instead of placeholders", () => {
    const source = readSource("src/hooks/use-amm.ts");

    expect(source).toContain("VITE_PUBLIC_AMM_ADDRESS");
    expect(source).toContain("VITE_PUBLIC_AMM_LORDS_ADDRESS");
    expect(source).toContain("VITE_PUBLIC_AMM_INDEXER_URL");
    expect(source).not.toContain("PLACEHOLDER_AMM_ADDRESS");
    expect(source).not.toContain("PLACEHOLDER_LORDS_ADDRESS");
    expect(source).not.toContain("PLACEHOLDER_INDEXER_URL");
  });

  it("uses approval builders for swaps and removes hardcoded mock pools from execution panels", () => {
    const swapSource = readSource("src/ui/features/amm/amm-swap.tsx");
    const addLiquiditySource = readSource("src/ui/features/amm/amm-add-liquidity.tsx");
    const removeLiquiditySource = readSource("src/ui/features/amm/amm-remove-liquidity.tsx");

    expect(swapSource).toContain("swapLordsForTokenWithApproval");
    expect(swapSource).toContain("swapTokenForLordsWithApproval");
    expect(swapSource).toContain("swapTokenForTokenWithApproval");
    expect(swapSource).not.toContain("const MOCK_POOL");
    expect(addLiquiditySource).not.toContain("const MOCK_POOL");
    expect(removeLiquiditySource).not.toContain("const MOCK_POOL");
  });

  it("documents the AMM dashboard in the latest features list", () => {
    const source = readSource("src/ui/features/world/latest-features.ts");

    expect(source).toContain("AMM");
  });
});
