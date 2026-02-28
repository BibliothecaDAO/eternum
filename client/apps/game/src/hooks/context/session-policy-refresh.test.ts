// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildPolicies: vi.fn(),
}));

vi.mock("./policies", () => ({
  buildPolicies: mocks.buildPolicies,
}));

vi.mock("../../../dojo-config", () => ({
  dojoConfig: { manifest: { mocked: true } },
}));

describe("session-policy-refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("refreshes once for same scope+payload and then dedupes", async () => {
    const { refreshSessionPoliciesWithPolicies, hasSessionPoliciesForScope } = await import("./session-policy-refresh");
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const connector = { controller: { updateSession } };
    const scope = "world:slot:test-world";
    const policies = { contracts: { "0x1": { methods: [{ name: "register", entrypoint: "register" }] } } };

    const first = await refreshSessionPoliciesWithPolicies(connector, policies, scope);
    const second = await refreshSessionPoliciesWithPolicies(connector, policies, scope);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(updateSession).toHaveBeenCalledTimes(1);
    expect(hasSessionPoliciesForScope(scope)).toBe(true);
  });

  it("does not refresh again while staying on the same world scope", async () => {
    const { refreshSessionPoliciesWithPolicies } = await import("./session-policy-refresh");
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const connector = { controller: { updateSession } };
    const scope = "world:slot:test-world";

    await refreshSessionPoliciesWithPolicies(
      connector,
      { contracts: { "0x1": { methods: [{ name: "register", entrypoint: "register" }] } } },
      scope,
    );
    await refreshSessionPoliciesWithPolicies(
      connector,
      { contracts: { "0x1": { methods: [{ name: "make_hyperstructures", entrypoint: "make_hyperstructures" }] } } },
      scope,
    );

    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("dedupes refresh when payload is semantically equal but object key order differs", async () => {
    const { refreshSessionPoliciesWithPolicies } = await import("./session-policy-refresh");
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const connector = { controller: { updateSession } };
    const scope = "world:slot:test-world";

    const policiesA = {
      contracts: {
        "0x2": {
          methods: [{ name: "make_hyperstructures", entrypoint: "make_hyperstructures" }],
        },
        "0x1": {
          methods: [{ name: "register", entrypoint: "register" }],
        },
      },
      messages: [
        {
          name: "Eternum Message Signing",
          domain: { name: "Eternum", version: "1" },
        },
      ],
    };

    const policiesB = {
      messages: [
        {
          domain: { version: "1", name: "Eternum" },
          name: "Eternum Message Signing",
        },
      ],
      contracts: {
        "0x1": {
          methods: [{ entrypoint: "register", name: "register" }],
        },
        "0x2": {
          methods: [{ entrypoint: "make_hyperstructures", name: "make_hyperstructures" }],
        },
      },
    };

    const first = await refreshSessionPoliciesWithPolicies(connector, policiesA, scope);
    const second = await refreshSessionPoliciesWithPolicies(connector, policiesB, scope);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });

  it("refreshes again when switching to a different world scope", async () => {
    const { refreshSessionPoliciesWithPolicies } = await import("./session-policy-refresh");
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const connector = { controller: { updateSession } };
    const policies = { contracts: { "0x1": { methods: [{ name: "register", entrypoint: "register" }] } } };

    await refreshSessionPoliciesWithPolicies(connector, policies, "world:slot:alpha");
    await refreshSessionPoliciesWithPolicies(connector, policies, "world:slot:beta");

    expect(updateSession).toHaveBeenCalledTimes(2);
  });

  it("refreshes again when returning to a previously visited world scope", async () => {
    const { refreshSessionPoliciesWithPolicies } = await import("./session-policy-refresh");
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const connector = { controller: { updateSession } };
    const policies = { contracts: { "0x1": { methods: [{ name: "register", entrypoint: "register" }] } } };

    await refreshSessionPoliciesWithPolicies(connector, policies, "world:slot:alpha");
    await refreshSessionPoliciesWithPolicies(connector, policies, "world:slot:beta");
    await refreshSessionPoliciesWithPolicies(connector, policies, "world:slot:alpha");

    expect(updateSession).toHaveBeenCalledTimes(3);
  });

  it("dedupes within same world scope even if connector instance changes", async () => {
    const { refreshSessionPoliciesWithPolicies } = await import("./session-policy-refresh");
    const updateSessionA = vi.fn().mockResolvedValue(undefined);
    const updateSessionB = vi.fn().mockResolvedValue(undefined);
    const scope = "world:slot:alpha";
    const policies = { contracts: { "0x1": { methods: [{ name: "register", entrypoint: "register" }] } } };

    await refreshSessionPoliciesWithPolicies(
      { controller: { updateSession: updateSessionA, account: { address: "0xabc" } } },
      policies,
      scope,
    );
    await refreshSessionPoliciesWithPolicies(
      { controller: { updateSession: updateSessionB, account: { address: "0xabc" } } },
      policies,
      scope,
    );

    expect(updateSessionA).toHaveBeenCalledTimes(1);
    expect(updateSessionB).not.toHaveBeenCalled();
  });

  it("refreshes for a different signer even on the same world scope", async () => {
    const { refreshSessionPoliciesWithPolicies } = await import("./session-policy-refresh");
    const updateSessionA = vi.fn().mockResolvedValue(undefined);
    const updateSessionB = vi.fn().mockResolvedValue(undefined);
    const scope = "world:slot:alpha";
    const policies = { contracts: { "0x1": { methods: [{ name: "register", entrypoint: "register" }] } } };

    await refreshSessionPoliciesWithPolicies(
      { controller: { updateSession: updateSessionA, account: { address: "0xabc" } } },
      policies,
      scope,
    );
    await refreshSessionPoliciesWithPolicies(
      { controller: { updateSession: updateSessionB, account: { address: "0xdef" } } },
      policies,
      scope,
    );

    expect(updateSessionA).toHaveBeenCalledTimes(1);
    expect(updateSessionB).toHaveBeenCalledTimes(1);
  });

  it("does not mark scope as refreshed when provider cannot update sessions", async () => {
    const { refreshSessionPoliciesWithPolicies, hasSessionPoliciesForScope } = await import("./session-policy-refresh");
    const connector = { controller: {} };
    const scope = "world:slot:test-world";
    const policies = { contracts: {} };

    const refreshed = await refreshSessionPoliciesWithPolicies(connector, policies, scope);

    expect(refreshed).toBe(false);
    expect(hasSessionPoliciesForScope(scope)).toBe(false);
  });

  it("uses buildPolicies for manifest-derived refresh", async () => {
    const builtPolicies = { contracts: { "0xabc": { methods: [{ name: "play", entrypoint: "play" }] } } };
    mocks.buildPolicies.mockReturnValue(builtPolicies);

    const { refreshSessionPolicies } = await import("./session-policy-refresh");
    const updateSession = vi.fn().mockResolvedValue(undefined);
    const connector = { controller: { updateSession } };

    const refreshed = await refreshSessionPolicies(connector, "world:mainnet:alpha");

    expect(refreshed).toBe(true);
    expect(mocks.buildPolicies).toHaveBeenCalledTimes(1);
    expect(updateSession).toHaveBeenCalledWith({ policies: builtPolicies });
  });
});
