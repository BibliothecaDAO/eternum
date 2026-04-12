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
});
