import { beforeEach, describe, expect, it, vi } from "vitest";

const applyWorldSelection = vi.fn();
const configureSelectedWorldDojoRuntime = vi.fn();
const refreshSessionPolicies = vi.fn();

vi.mock("@/runtime/world", () => ({
  applyWorldSelection,
}));

vi.mock("@/runtime/world/dojo-runtime-config", () => ({
  configureSelectedWorldDojoRuntime,
}));

vi.mock("./session-policy-refresh", () => ({
  refreshSessionPolicies,
}));

import { prepareControllerSessionForWorld } from "./world-controller-session";

describe("prepareControllerSessionForWorld", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies the selected world before refreshing controller session policies", async () => {
    const connector = { id: "controller" };
    const profile = {
      name: "aurora-blitz",
      chain: "slot",
      rpcUrl: "https://rpc.example/aurora",
      toriiBaseUrl: "https://torii.example/aurora",
      worldAddress: "0x123",
      contractsBySelector: { "0xabc": "0xdef" },
    };

    applyWorldSelection.mockResolvedValue({
      profile,
      currentChain: "slot",
      targetChain: "slot",
      chainChanged: false,
    });

    await prepareControllerSessionForWorld({
      connector,
      chain: "slot",
      worldName: "aurora-blitz",
    });

    expect(applyWorldSelection).toHaveBeenCalledWith({ name: "aurora-blitz", chain: "slot" }, "slot");
    expect(configureSelectedWorldDojoRuntime).toHaveBeenCalledWith({
      chain: "slot",
      profile,
    });
    expect(refreshSessionPolicies).toHaveBeenCalledWith(connector);
    expect(applyWorldSelection.mock.invocationCallOrder[0]).toBeLessThan(
      configureSelectedWorldDojoRuntime.mock.invocationCallOrder[0],
    );
    expect(configureSelectedWorldDojoRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      refreshSessionPolicies.mock.invocationCallOrder[0],
    );
  });
});
