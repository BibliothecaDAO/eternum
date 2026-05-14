// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("useLandingNetworkState source", () => {
  it("re-resolves the connected chain on every render instead of memoizing against the mutable controller object", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/hooks/use-landing-network-state.ts"),
      "utf8",
    );

    expect(source).toContain("const connectedChain = resolveConnectedTxChainFromRuntime({ chainId, controller });");
    expect(source).not.toContain("useMemo(\n    () => resolveConnectedTxChainFromRuntime({ chainId, controller })");
  });

  it("seeds mainnet only when no landing chain preference has been saved", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/hooks/use-landing-network-state.ts"),
      "utf8",
    );

    expect(source).toContain('const DEFAULT_LANDING_CHAIN: Chain = "mainnet";');
    expect(source).toContain("const selectDefaultLandingChainIfMissing = () => {");
    expect(source).toContain("if (getSelectedChain()) return;");
    expect(source).toContain("const selectedChain = useSelectedRuntimeChain(DEFAULT_LANDING_CHAIN);");
    expect(source).toContain("setSelectedChain(DEFAULT_LANDING_CHAIN);");
    expect(source).not.toContain("hasDefaultedLandingChainOnPageOpen");
    expect(source).not.toContain("shouldStartOnDefaultLandingChain");
  });
});
