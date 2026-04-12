// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createPendingNetworkAction, resolvePendingNetworkSwitchOutcome } from "./pending-network-action";

describe("pending network action", () => {
  it("returns a persistence and replay plan when the wallet switch succeeds", () => {
    const replay = vi.fn();
    const pendingAction = createPendingNetworkAction("mainnet", "game", replay);

    const outcome = resolvePendingNetworkSwitchOutcome({
      pendingAction,
      latestPendingAction: pendingAction,
      switched: true,
    });

    expect(outcome.pendingAction).toBeNull();
    expect(outcome.selectedChain).toBe("mainnet");

    outcome.replay?.();

    expect(replay).toHaveBeenCalledTimes(1);
  });

  it("keeps the pending action queued when the wallet switch fails", () => {
    const replay = vi.fn();
    const pendingAction = createPendingNetworkAction("mainnet", "game", replay);

    const outcome = resolvePendingNetworkSwitchOutcome({
      pendingAction,
      switched: false,
    });

    expect(outcome.pendingAction).toBe(pendingAction);
    expect(outcome.selectedChain).toBeNull();
    expect(outcome.replay).toBeNull();
    expect(replay).not.toHaveBeenCalled();
  });

  it("does not replay an action that was dismissed while the wallet switch was in flight", () => {
    const replay = vi.fn();
    const pendingAction = createPendingNetworkAction("mainnet", "game", replay);

    const outcome = resolvePendingNetworkSwitchOutcome({
      pendingAction,
      latestPendingAction: null,
      switched: true,
    });

    expect(outcome.pendingAction).toBeNull();
    expect(outcome.selectedChain).toBeNull();
    expect(outcome.replay).toBeNull();
    expect(replay).not.toHaveBeenCalled();
  });
});
