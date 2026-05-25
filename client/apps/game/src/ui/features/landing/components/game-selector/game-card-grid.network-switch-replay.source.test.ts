// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("Game card network switch replay", () => {
  it("switches through the shared landing network state without replaying stale or duplicate actions", () => {
    const source = readFileSync(fileURLToPath(new URL("./game-card-grid.tsx", import.meta.url)), "utf8");

    expect(source).toContain('import { useLandingNetworkState } from "../../hooks/use-landing-network-state";');
    expect(source).toContain("canInteractWithLandingChain");
    expect(source).toContain("resolvePreferredLandingChain");
    expect(source).toContain("const [isSwitchNetworkPending, setIsSwitchNetworkPending] = useState(false);");
    expect(source).toContain("resolvePendingNetworkSwitchOutcome");
    expect(source).toContain(
      "switchToPreferredChain(resolvePreferredLandingChain(requestedPendingAction.targetChain))",
    );
    expect(source).toContain("if (!pendingNetworkAction || isSwitchNetworkPending) return;");
    expect(source).toContain("latestPendingAction:");
    expect(source).not.toContain("onClose={() => setPendingNetworkAction(null)}");
  });

  it("does not block read-only spectate behind wallet network switching", () => {
    const source = readFileSync(fileURLToPath(new URL("./game-card-grid.tsx", import.meta.url)), "utf8");

    expect(source).toContain("onClick={onSpectate}");
    expect(source).not.toContain("onClick={() => runWithNetworkGuard(onSpectate)}");
  });
});
