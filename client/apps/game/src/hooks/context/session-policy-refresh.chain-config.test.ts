import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("session policy refresh chain config", () => {
  it("rebinds controller chain config alongside policy refresh", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/session-policy-refresh.ts"), "utf8");

    expect(source).toContain("resolveControllerNetworkConfig");
    expect(source).toContain("provider.options.chains =");
    expect(source).toContain("provider.options.defaultChainId =");
  });
});
