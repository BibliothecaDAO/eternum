// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("LandingPlayer MMR RPC selection", () => {
  it("uses the shared slot RPC instead of the current dojo runtime RPC for slot profiles", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/player-profile.tsx"),
      "utf8",
    );

    expect(source).toContain("buildSharedSlotRpcUrl(cartridgeApiBase)");
    expect(source).not.toContain("dojoConfig.rpcUrl");
  });
});
