import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("DojoConfigProvider chain override", () => {
  it("accepts an explicit chain and resolves manifest from it", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pm/hooks/dojo/dojo-config.tsx"), "utf8");

    expect(source).toContain("chain?: PredictionMarketChain");
    expect(source).toContain("const resolvedChain = chain ?? getPredictionMarketChain()");
    expect(source).toContain("loadPredictionMarketManifest(resolvedChain)");
  });
});
