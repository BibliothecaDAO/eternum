// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("Game card network switch replay", () => {
  it("switches through the shared landing network state and replays the blocked action after a successful modal switch", () => {
    const source = readFileSync(fileURLToPath(new URL("./game-card-grid.tsx", import.meta.url)), "utf8");

    expect(source).toContain('import { useLandingNetworkState } from "../../hooks/use-landing-network-state";');
    expect(source).toContain(
      'import { canInteractWithLandingChain, resolvePreferredLandingChain } from "../../lib/landing-network-state";',
    );
    expect(source).toContain("resolvePendingNetworkSwitchOutcome");
    expect(source).toContain("switchToPreferredChain(resolvePreferredLandingChain(pendingNetworkAction.targetChain))");
    expect(source).toContain("outcome.replay?.();");
  });
});
