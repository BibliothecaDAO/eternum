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

  it("owns one module-lifetime controller connector with passkey popup support", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/starknet-provider.tsx"), "utf8");

    expect(source.match(/new ControllerConnector\(/g)).toHaveLength(1);
    expect(source).toContain("const controller = new ControllerConnector");
    expect(source).toContain("webauthnPopup: true");
    expect(source).not.toContain("const controller = useMemo");
  });
});
