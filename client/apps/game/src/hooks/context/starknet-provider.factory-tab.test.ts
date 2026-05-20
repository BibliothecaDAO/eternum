import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("StarknetProvider factory bootstrap guard", () => {
  it("derives its runtime config from the shared runtime-chain state instead of duplicating chain resolution", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/starknet-provider.tsx"), "utf8");

    expect(source).toContain("resolveStarknetRuntimeConfig");
    expect(source).toContain("useRuntimeChain");
    expect(source).not.toContain("deriveChainFromRpcUrl");
  });
});
