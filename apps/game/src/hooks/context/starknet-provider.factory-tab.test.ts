import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("StarknetProvider identity boundary", () => {
  it("keeps game-chain resolution out of the identity wallet provider", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/starknet-provider.tsx"), "utf8");

    expect(source).toContain("VITE_PUBLIC_IDENTITY_RPC_URL");
    expect(source).not.toContain("useRuntimeChain");
    expect(source).not.toContain("VITE_PUBLIC_NODE_URL");
  });

  it("offers extension wallets without Controller or paymaster wiring", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/starknet-provider.tsx"), "utf8");

    expect(source).toContain("[ready(), braavos()]");
    expect(source).not.toContain("ControllerConnector");
    expect(source).not.toContain("paymaster");
  });
});
