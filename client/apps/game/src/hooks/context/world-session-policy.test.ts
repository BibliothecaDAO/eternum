// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveWorld: vi.fn(),
  buildWorldProfile: vi.fn(),
  buildWorldPolicies: vi.fn(),
  refreshSessionPoliciesWithPolicies: vi.fn(),
}));

vi.mock("@/runtime/world/store", () => ({
  getActiveWorld: mocks.getActiveWorld,
}));

vi.mock("@/runtime/world/profile-builder", () => ({
  buildWorldProfile: mocks.buildWorldProfile,
}));

vi.mock("./policies", () => ({
  buildWorldPolicies: mocks.buildWorldPolicies,
}));

vi.mock("./session-policy-refresh", () => ({
  refreshSessionPoliciesWithPolicies: mocks.refreshSessionPoliciesWithPolicies,
}));

vi.mock("../../../env", () => ({
  env: {
    VITE_PUBLIC_VRF_PROVIDER_ADDRESS: "0xvrf",
  },
}));

describe("world-session-policy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses active world profile when it matches chain+world", async () => {
    const activeWorld = {
      name: "alpha",
      chain: "slot",
      worldAddress: "0x123",
      contractsBySelector: { "0x1": "0xaaa" },
      feeTokenAddress: "0xf",
      entryTokenAddress: "0xe",
      toriiBaseUrl: "",
      rpcUrl: "",
      fetchedAt: Date.now(),
    };
    const policies = { contracts: {} };
    mocks.getActiveWorld.mockReturnValue(activeWorld);
    mocks.buildWorldPolicies.mockReturnValue(policies);
    mocks.refreshSessionPoliciesWithPolicies.mockResolvedValue(true);

    const { ensureWorldSessionPolicies } = await import("./world-session-policy");
    const result = await ensureWorldSessionPolicies({
      connector: { controller: { updateSession: vi.fn() } },
      chain: "slot",
      worldName: "alpha",
    });

    expect(result).toBe(true);
    expect(mocks.buildWorldProfile).not.toHaveBeenCalled();
    expect(mocks.buildWorldPolicies).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "slot",
        contractsBySelector: activeWorld.contractsBySelector,
        worldAddress: activeWorld.worldAddress,
        feeTokenAddress: activeWorld.feeTokenAddress,
        entryTokenAddress: activeWorld.entryTokenAddress,
      }),
    );
    expect(mocks.refreshSessionPoliciesWithPolicies).toHaveBeenCalledWith(
      expect.anything(),
      policies,
      "world:slot:alpha",
    );
  });

  it("builds world profile when active world does not match", async () => {
    const builtWorld = {
      name: "beta",
      chain: "slot",
      worldAddress: "0x999",
      contractsBySelector: { "0x2": "0xbb" },
      feeTokenAddress: undefined,
      entryTokenAddress: undefined,
      toriiBaseUrl: "",
      rpcUrl: "",
      fetchedAt: Date.now(),
    };
    const policies = { contracts: {} };
    mocks.getActiveWorld.mockReturnValue({
      name: "alpha",
      chain: "slot",
      contractsBySelector: {},
      worldAddress: "0x0",
      toriiBaseUrl: "",
      rpcUrl: "",
      fetchedAt: Date.now(),
    });
    mocks.buildWorldProfile.mockResolvedValue(builtWorld);
    mocks.buildWorldPolicies.mockReturnValue(policies);
    mocks.refreshSessionPoliciesWithPolicies.mockResolvedValue(true);

    const { ensureWorldSessionPolicies } = await import("./world-session-policy");
    const result = await ensureWorldSessionPolicies({
      connector: { controller: { updateSession: vi.fn() } },
      chain: "slot",
      worldName: "beta",
    });

    expect(result).toBe(true);
    expect(mocks.buildWorldProfile).toHaveBeenCalledWith("slot", "beta");
    expect(mocks.refreshSessionPoliciesWithPolicies).toHaveBeenCalledWith(
      expect.anything(),
      policies,
      "world:slot:beta",
    );
  });

  it("short-circuits without connector", async () => {
    const { ensureWorldSessionPolicies } = await import("./world-session-policy");
    const result = await ensureWorldSessionPolicies({
      connector: null,
      chain: "slot",
      worldName: "alpha",
    });

    expect(result).toBe(false);
    expect(mocks.buildWorldProfile).not.toHaveBeenCalled();
    expect(mocks.refreshSessionPoliciesWithPolicies).not.toHaveBeenCalled();
  });

  it("uses provided profile chain+name for scope and policy build", async () => {
    const providedProfile = {
      name: "actual-slot-world",
      chain: "slot" as const,
      worldAddress: "0x456",
      contractsBySelector: { "0x1": "0xabc" },
      feeTokenAddress: "0xf",
      entryTokenAddress: "0xe",
      toriiBaseUrl: "",
      rpcUrl: "",
      fetchedAt: Date.now(),
    };
    const policies = { contracts: {} };
    mocks.buildWorldPolicies.mockReturnValue(policies);
    mocks.refreshSessionPoliciesWithPolicies.mockResolvedValue(true);

    const { ensureWorldSessionPolicies } = await import("./world-session-policy");
    const result = await ensureWorldSessionPolicies({
      connector: { controller: { updateSession: vi.fn() } },
      chain: "mainnet",
      worldName: "requested-mainnet-world",
      profile: providedProfile,
    });

    expect(result).toBe(true);
    expect(mocks.buildWorldPolicies).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: "slot",
      }),
    );
    expect(mocks.refreshSessionPoliciesWithPolicies).toHaveBeenCalledWith(
      expect.anything(),
      policies,
      "world:slot:actual-slot-world",
    );
  });
});
