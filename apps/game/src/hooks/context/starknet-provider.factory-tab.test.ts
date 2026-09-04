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

  it("offers the extension wallets and Controller as identity wallets, without paymaster wiring", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/starknet-provider.tsx"), "utf8");

    expect(source).toContain("[controller, ready(), braavos()]");
    expect(source).not.toContain("paymasterProvider");
    expect(source).not.toContain("policies:");
  });

  it("never starts the Controller keychain without a wallet action", () => {
    // The keychain iframe is a vendor client with its own authed RPCs: without `lazyload` it boots at module load
    // and polls unauthenticated for every anonymous spectator.
    const source = readFileSync(resolve(process.cwd(), "src/hooks/context/starknet-provider.tsx"), "utf8");

    expect(source).toContain("lazyload: true");
  });
});
