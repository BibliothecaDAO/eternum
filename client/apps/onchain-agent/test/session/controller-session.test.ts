import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ctorCalls: [] as any[],
}));

vi.mock("@cartridge/controller/session/node", () => ({
  default: class {
    constructor(opts: unknown) {
      mocks.ctorCalls.push(opts);
    }

    async probe() {
      return undefined;
    }

    async connect() {
      return { address: "0xsession" };
    }

    async disconnect() {
      return undefined;
    }
  },
}));

import { ControllerSession, buildSessionPoliciesFromManifest } from "../../src/session/controller-session";

describe("controller session policies", () => {
  it("builds session policies from manifest systems arrays", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0x111", systems: ["send", "pickup", "arrivals_offload"] },
        {
          tag: "s1_eternum-guild_systems",
          address: "0x222",
          systems: ["create_guild", "join_guild", "leave_guild", "update_whitelist"],
        },
      ],
    } as any);

    expect(policies.contracts?.["0x111"]).toBeDefined();
    expect(policies.contracts?.["0x111"]?.methods?.some((m: any) => m.entrypoint === "send")).toBe(true);
    expect(policies.contracts?.["0x111"]?.methods?.some((m: any) => m.entrypoint === "pickup")).toBe(true);
    expect(policies.contracts?.["0x111"]?.methods?.some((m: any) => m.entrypoint === "arrivals_offload")).toBe(true);
    expect(policies.contracts?.["0x222"]?.methods?.some((m: any) => m.entrypoint === "update_whitelist")).toBe(true);
  });

  it("skips contracts with no systems array", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0x111", systems: ["send"] },
        { tag: "s1_eternum-some_model", address: "0x222" },
      ],
    } as any);

    expect(policies.contracts?.["0x111"]).toBeDefined();
    expect(policies.contracts?.["0x222"]).toBeUndefined();
  });

  it("skips contracts with empty systems array", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0x111", systems: ["send"] },
        { tag: "s1_eternum-point_systems", address: "0x222", systems: [] },
      ],
    } as any);

    expect(policies.contracts?.["0x111"]).toBeDefined();
    expect(policies.contracts?.["0x222"]).toBeUndefined();
  });

  it("excludes the upgrade entrypoint", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0x111", systems: ["send", "upgrade"] },
        { tag: "s1_eternum-point_systems", address: "0x222", systems: ["upgrade"] },
      ],
    } as any);

    const methods = (policies.contracts?.["0x111"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(methods).toContain("send");
    expect(methods).not.toContain("upgrade");
    // point_systems only had "upgrade", so it should be excluded entirely
    expect(policies.contracts?.["0x222"]).toBeUndefined();
  });

  it("filters contracts by game name when provided", () => {
    const policies = buildSessionPoliciesFromManifest(
      {
        contracts: [
          { tag: "s1_eternum-resource_systems", address: "0x111", systems: ["send"] },
          { tag: "s1_othergame-resource_systems", address: "0x222", systems: ["send"] },
        ],
      } as any,
      { gameName: "othergame" },
    );

    expect(policies.contracts?.["0x222"]).toBeDefined();
    expect(policies.contracts?.["0x111"]).toBeUndefined();
  });

  it("passes generated policies to SessionProvider", () => {
    new ControllerSession({
      rpcUrl: "http://localhost:5050",
      chainId: "SN_SEPOLIA",
      basePath: ".cartridge",
      gameName: "eternum",
      manifest: {
        contracts: [{ tag: "s1_eternum-resource_systems", address: "0xabc", systems: ["send", "pickup"] }],
      } as any,
    });

    expect(mocks.ctorCalls).toHaveLength(1);
    const opts = mocks.ctorCalls[0];
    expect(opts.basePath).toBe(".cartridge");
    expect(opts.policies?.contracts?.["0xabc"]).toBeDefined();
  });

  it("reads all entrypoints from manifest systems arrays", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        {
          tag: "s1_eternum-resource_systems",
          address: "0xres",
          systems: ["approve", "send", "pickup", "arrivals_offload", "troop_burn", "structure_burn"],
        },
        {
          tag: "s1_eternum-production_systems",
          address: "0xprod",
          systems: ["create_building", "destroy_building", "pause_building_production", "resume_building_production"],
        },
        { tag: "s1_eternum-bank_systems", address: "0xbank", systems: ["create_banks", "upgrade"] },
        { tag: "s1_eternum-swap_systems", address: "0xswap", systems: ["buy", "sell"] },
        { tag: "s1_eternum-liquidity_systems", address: "0xliq", systems: ["add", "remove"] },
        { tag: "s1_eternum-realm_systems", address: "0xrealm", systems: ["create", "upgrade"] },
      ],
    } as any);

    const resourceEntrypoints = (policies.contracts?.["0xres"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(resourceEntrypoints).toContain("send");
    expect(resourceEntrypoints).toContain("pickup");
    expect(resourceEntrypoints).toContain("troop_burn");
    expect(resourceEntrypoints).toContain("structure_burn");

    const productionEntrypoints = (policies.contracts?.["0xprod"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(productionEntrypoints).toContain("pause_building_production");
    expect(productionEntrypoints).toContain("resume_building_production");

    const swapEntrypoints = (policies.contracts?.["0xswap"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(swapEntrypoints).toContain("buy");
    expect(swapEntrypoints).toContain("sell");

    const liquidityEntrypoints = (policies.contracts?.["0xliq"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(liquidityEntrypoints).toContain("add");
    expect(liquidityEntrypoints).toContain("remove");

    const realmEntrypoints = (policies.contracts?.["0xrealm"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(realmEntrypoints).toContain("create");
    expect(realmEntrypoints).not.toContain("upgrade");
  });

  it("throws when no contracts have systems", () => {
    expect(() =>
      buildSessionPoliciesFromManifest({
        contracts: [
          { tag: "s1_eternum-some_model", address: "0x111" },
          { tag: "s1_eternum-another_model", address: "0x222", systems: [] },
        ],
      } as any),
    ).toThrow("no system contracts with entrypoints found");
  });

  it("deduplicates methods when same address appears in multiple contracts", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-system_a", address: "0xsame", systems: ["foo", "bar"] },
        { tag: "s1_eternum-system_b", address: "0xsame", systems: ["bar", "baz"] },
      ],
    } as any);

    const methods = (policies.contracts?.["0xsame"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(methods).toContain("foo");
    expect(methods).toContain("bar");
    expect(methods).toContain("baz");
    expect(methods.length).toBe(3);
  });
});
