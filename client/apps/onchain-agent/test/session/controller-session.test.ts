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
  it("builds Eternum session policies from manifest system contracts", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0x111" },
        { tag: "s1_eternum-guild_systems", address: "0x222" },
      ],
    } as any);

    expect(policies.contracts?.["0x111"]).toBeDefined();
    expect(policies.contracts?.["0x111"]?.methods?.some((m: any) => m.entrypoint === "send")).toBe(true);
    expect(policies.contracts?.["0x222"]?.methods?.some((m: any) => m.entrypoint === "update_whitelist")).toBe(true);
  });

  it("filters contracts by game name when provided", () => {
    const policies = buildSessionPoliciesFromManifest(
      {
        contracts: [
          { tag: "s1_eternum-resource_systems", address: "0x111" },
          { tag: "s1_othergame-resource_systems", address: "0x222" },
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
        contracts: [{ tag: "s1_eternum-resource_systems", address: "0xabc" }],
      } as any,
    });

    expect(mocks.ctorCalls).toHaveLength(1);
    const opts = mocks.ctorCalls[0];
    expect(opts.basePath).toBe(".cartridge");
    expect(opts.policies?.contracts?.["0xabc"]).toBeDefined();
  });

  it("uses real contract entrypoints used by provider transactions", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0xres" },
        { tag: "s1_eternum-production_systems", address: "0xprod" },
        { tag: "s1_eternum-bank_systems", address: "0xbank" },
        { tag: "s1_eternum-liquidity_systems", address: "0xliq" },
        { tag: "s1_eternum-realm_systems", address: "0xrealm" },
      ],
    } as any);

    const resourceEntrypoints = (policies.contracts?.["0xres"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(resourceEntrypoints).toContain("send");
    expect(resourceEntrypoints).toContain("pickup");
    expect(resourceEntrypoints).not.toContain("send_resources");
    expect(resourceEntrypoints).not.toContain("pickup_resources");

    const productionEntrypoints = (policies.contracts?.["0xprod"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(productionEntrypoints).toContain("pause_building_production");
    expect(productionEntrypoints).toContain("resume_building_production");

    const bankEntrypoints = (policies.contracts?.["0xbank"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(bankEntrypoints).toContain("buy");
    expect(bankEntrypoints).toContain("sell");

    const liquidityEntrypoints = (policies.contracts?.["0xliq"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(liquidityEntrypoints).toContain("add");
    expect(liquidityEntrypoints).toContain("remove");

    const realmEntrypoints = (policies.contracts?.["0xrealm"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(realmEntrypoints).toContain("level_up");
  });
});
