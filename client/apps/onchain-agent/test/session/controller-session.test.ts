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

  it("routes buy/sell to swap_systems (not bank_systems)", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-swap_systems", address: "0xswap" },
        { tag: "s1_eternum-bank_systems", address: "0xbank" },
      ],
    } as any);

    const swapEntrypoints = (policies.contracts?.["0xswap"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(swapEntrypoints).toContain("buy");
    expect(swapEntrypoints).toContain("sell");

    const bankEntrypoints = (policies.contracts?.["0xbank"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(bankEntrypoints).toContain("create_banks");
    expect(bankEntrypoints).not.toContain("buy");
    expect(bankEntrypoints).not.toContain("sell");
  });

  it("routes level_up to structure_systems (not realm_systems)", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-structure_systems", address: "0xstruct" },
        { tag: "s1_eternum-realm_systems", address: "0xrealm" },
      ],
    } as any);

    const structEntrypoints = (policies.contracts?.["0xstruct"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(structEntrypoints).toContain("level_up");

    const realmEntrypoints = (policies.contracts?.["0xrealm"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(realmEntrypoints).not.toContain("level_up");
    expect(realmEntrypoints).toContain("create");
  });

  it("includes dojo_name and world_dispatcher on all system contracts", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0xres" },
        { tag: "s1_eternum-trade_systems", address: "0xtrade" },
        { tag: "s1_eternum-guild_systems", address: "0xguild" },
      ],
    } as any);

    for (const addr of ["0xres", "0xtrade", "0xguild"]) {
      const entrypoints = (policies.contracts?.[addr]?.methods ?? []).map((m: any) => m.entrypoint);
      expect(entrypoints).toContain("dojo_name");
      expect(entrypoints).toContain("world_dispatcher");
    }
  });

  it("always includes VRF provider policy", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [{ tag: "s1_eternum-resource_systems", address: "0xres" }],
    } as any);

    const vrfAddress = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
    expect(policies.contracts?.[vrfAddress]).toBeDefined();
    expect(policies.contracts?.[vrfAddress]?.methods?.some((m: any) => m.entrypoint === "request_random")).toBe(true);
  });

  it("includes token policies when worldProfile provides addresses", () => {
    const policies = buildSessionPoliciesFromManifest(
      {
        contracts: [{ tag: "s1_eternum-resource_systems", address: "0xres" }],
      } as any,
      {
        worldProfile: {
          name: "test",
          chain: "slot",
          toriiBaseUrl: "http://example.com",
          worldAddress: "0x1",
          contractsBySelector: {},
          entryTokenAddress: "0xentry",
          feeTokenAddress: "0xfee",
          fetchedAt: Date.now(),
        },
      },
    );

    expect(policies.contracts?.["0xentry"]).toBeDefined();
    expect(policies.contracts?.["0xentry"]?.methods?.some((m: any) => m.entrypoint === "token_lock")).toBe(true);

    expect(policies.contracts?.["0xfee"]).toBeDefined();
    expect(policies.contracts?.["0xfee"]?.methods?.some((m: any) => m.entrypoint === "approve")).toBe(true);
  });

  it("skips entry token policy when address is 0x0", () => {
    const policies = buildSessionPoliciesFromManifest(
      {
        contracts: [{ tag: "s1_eternum-resource_systems", address: "0xres" }],
      } as any,
      {
        worldProfile: {
          name: "test",
          chain: "slot",
          toriiBaseUrl: "http://example.com",
          worldAddress: "0x1",
          contractsBySelector: {},
          entryTokenAddress: "0x0",
          fetchedAt: Date.now(),
        },
      },
    );

    expect(policies.contracts?.["0x0"]).toBeUndefined();
  });

  it("includes message signing policy", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [{ tag: "s1_eternum-resource_systems", address: "0xres" }],
    } as any) as any;

    expect(policies.messages).toBeDefined();
    expect(Array.isArray(policies.messages)).toBe(true);
    expect(policies.messages.length).toBeGreaterThan(0);
    expect(policies.messages[0].primaryType).toBe("s1_eternum-Message");
  });

  it("does not match tag via substring (only exact or dash-suffix)", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-some_trade_systems_v2", address: "0xnomatch" },
        { tag: "s1_eternum-trade_systems", address: "0xmatch" },
      ],
    } as any);

    // The exact suffix match should work
    expect(policies.contracts?.["0xmatch"]).toBeDefined();
    // The substring match should NOT work (old bug: tag.includes(suffix))
    expect(policies.contracts?.["0xnomatch"]).toBeUndefined();
  });

  it("uses real contract entrypoints used by provider transactions", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-resource_systems", address: "0xres" },
        { tag: "s1_eternum-production_systems", address: "0xprod" },
        { tag: "s1_eternum-swap_systems", address: "0xswap" },
        { tag: "s1_eternum-liquidity_systems", address: "0xliq" },
        { tag: "s1_eternum-structure_systems", address: "0xstruct" },
      ],
    } as any);

    const resourceEntrypoints = (policies.contracts?.["0xres"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(resourceEntrypoints).toContain("send");
    expect(resourceEntrypoints).toContain("pickup");
    expect(resourceEntrypoints).toContain("approve");
    expect(resourceEntrypoints).toContain("deposit");
    expect(resourceEntrypoints).toContain("withdraw");

    const productionEntrypoints = (policies.contracts?.["0xprod"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(productionEntrypoints).toContain("pause_building_production");
    expect(productionEntrypoints).toContain("resume_building_production");
    expect(productionEntrypoints).toContain("burn_resource_for_labor_production");

    const swapEntrypoints = (policies.contracts?.["0xswap"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(swapEntrypoints).toContain("buy");
    expect(swapEntrypoints).toContain("sell");

    const liquidityEntrypoints = (policies.contracts?.["0xliq"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(liquidityEntrypoints).toContain("add");
    expect(liquidityEntrypoints).toContain("remove");

    const structEntrypoints = (policies.contracts?.["0xstruct"]?.methods ?? []).map((m: any) => m.entrypoint);
    expect(structEntrypoints).toContain("level_up");
  });

  it("includes all missing system contracts from canonical policies", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "s1_eternum-config_systems", address: "0xconfig" },
        { tag: "s1_eternum-name_systems", address: "0xname" },
        { tag: "s1_eternum-ownership_systems", address: "0xown" },
        { tag: "s1_eternum-dev_resource_systems", address: "0xdev" },
        { tag: "s1_eternum-relic_systems", address: "0xrelic" },
        { tag: "s1_eternum-season_systems", address: "0xseason" },
        { tag: "s1_eternum-village_systems", address: "0xvillage" },
        { tag: "s1_eternum-blitz_realm_systems", address: "0xblitz" },
        { tag: "s1_eternum-troop_movement_util_systems", address: "0xutil" },
      ],
    } as any);

    expect(policies.contracts?.["0xconfig"]?.methods?.some((m: any) => m.entrypoint === "set_agent_config")).toBe(true);
    expect(policies.contracts?.["0xname"]?.methods?.some((m: any) => m.entrypoint === "set_address_name")).toBe(true);
    expect(policies.contracts?.["0xown"]?.methods?.some((m: any) => m.entrypoint === "transfer_structure_ownership")).toBe(true);
    expect(policies.contracts?.["0xdev"]?.methods?.some((m: any) => m.entrypoint === "mint")).toBe(true);
    expect(policies.contracts?.["0xrelic"]?.methods?.some((m: any) => m.entrypoint === "open_chest")).toBe(true);
    expect(policies.contracts?.["0xseason"]?.methods?.some((m: any) => m.entrypoint === "register_to_leaderboard")).toBe(true);
    expect(policies.contracts?.["0xvillage"]?.methods?.some((m: any) => m.entrypoint === "upgrade")).toBe(true);
    expect(policies.contracts?.["0xblitz"]?.methods?.some((m: any) => m.entrypoint === "register")).toBe(true);
    expect(policies.contracts?.["0xutil"]?.methods?.some((m: any) => m.entrypoint === "dojo_name")).toBe(true);
  });
});
