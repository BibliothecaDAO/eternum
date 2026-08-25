// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("LandingPlayer MMR RPC selection", () => {
  it("pins MMR reads to the mainnet public RPC instead of the dojo runtime RPC", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/player-profile.tsx"),
      "utf8",
    );

    expect(source).toContain("RPC_FALLBACK_BY_CHAIN.mainnet");
    expect(source).toContain("MMR_TOKEN_BY_CHAIN.mainnet");
    expect(source).not.toContain("dojoConfig.rpcUrl");
  });
});
