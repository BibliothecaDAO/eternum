// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { refreshBootstrapPoliciesIfNeeded } from "./game-entry-modal.session-refresh";

describe("refreshBootstrapPoliciesIfNeeded", () => {
  it("refreshes when connector is present and not in spectate mode", async () => {
    const refreshPolicies = vi.fn().mockResolvedValue(true);
    const result = await refreshBootstrapPoliciesIfNeeded({
      connector: { controller: { updateSession: vi.fn() } },
      isSpectateMode: false,
      refreshPolicies,
    });

    expect(result).toBe(true);
    expect(refreshPolicies).toHaveBeenCalledTimes(1);
  });

  it("never refreshes in spectate mode", async () => {
    const refreshPolicies = vi.fn().mockResolvedValue(true);
    const result = await refreshBootstrapPoliciesIfNeeded({
      connector: { controller: { updateSession: vi.fn() } },
      isSpectateMode: true,
      refreshPolicies,
    });

    expect(result).toBe(false);
    expect(refreshPolicies).not.toHaveBeenCalled();
  });

  it("never refreshes without a connector", async () => {
    const refreshPolicies = vi.fn().mockResolvedValue(true);
    const result = await refreshBootstrapPoliciesIfNeeded({
      connector: null,
      isSpectateMode: false,
      refreshPolicies,
    });

    expect(result).toBe(false);
    expect(refreshPolicies).not.toHaveBeenCalled();
  });
});
