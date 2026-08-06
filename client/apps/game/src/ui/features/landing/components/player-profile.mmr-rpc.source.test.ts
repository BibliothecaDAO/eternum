// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("LandingPlayer MMR RPC selection", () => {
  it("uses a per-chain public RPC instead of the current dojo runtime RPC", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/player-profile.tsx"),
      "utf8",
    );

    expect(source).toContain("RPC_FALLBACK_BY_CHAIN[chain]");
    expect(source).not.toContain("dojoConfig.rpcUrl");
  });
});
