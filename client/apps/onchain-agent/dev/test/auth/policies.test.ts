import { describe, it, expect } from "vitest";
import { buildPolicies } from "../../../src/auth/policies.js";

describe("buildPolicies", () => {
  it("builds mainnet policies with all expected system contracts", () => {
    const policies = buildPolicies("mainnet");

    const addresses = Object.keys(policies.contracts ?? {});
    expect(addresses.length).toBeGreaterThan(20);

    // VRF contract should be present
    const vrf =
      "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
    expect(policies.contracts?.[vrf]).toBeDefined();
    expect(policies.contracts?.[vrf]?.methods).toContainEqual(
      expect.objectContaining({ entrypoint: "request_random" }),
    );

    // Troop battle should have the 3 attack methods + dojo methods
    const battleAddr = addresses.find((a) => {
      const methods = policies.contracts?.[a]?.methods ?? [];
      return methods.some(
        (m: any) => m.entrypoint === "attack_explorer_vs_explorer",
      );
    });
    expect(battleAddr).toBeDefined();
  });

  it("includes season pass and village pass", () => {
    const policies = buildPolicies("mainnet");
    const addresses = Object.keys(policies.contracts ?? {});

    const approvalContracts = addresses.filter((a) => {
      const methods = policies.contracts?.[a]?.methods ?? [];
      return methods.some(
        (m: any) => m.entrypoint === "set_approval_for_all",
      );
    });
    expect(approvalContracts.length).toBe(2);
  });

  it("includes message signing policy", () => {
    const policies = buildPolicies("mainnet");
    expect(policies.messages).toBeDefined();
    expect(policies.messages?.length).toBe(1);
    expect(policies.messages?.[0].primaryType).toBe("s1_eternum-Message");
    expect(policies.messages?.[0].domain.chainId).toBe("SN_MAIN");
  });

  it("uses SN_SEPOLIA for non-mainnet chains", () => {
    const policies = buildPolicies("sepolia");
    expect(policies.messages?.[0].domain.chainId).toBe("SN_SEPOLIA");
  });

  it("blitz_realm_systems does not include dojo methods", () => {
    const policies = buildPolicies("mainnet");
    const blitz = Object.entries(policies.contracts).find(([_, v]) =>
      v.methods.some((m) => m.entrypoint === "make_hyperstructures"),
    );
    expect(blitz).toBeDefined();
    const methods = blitz![1].methods.map((m) => m.entrypoint);
    expect(methods).not.toContain("dojo_name");
    expect(methods).not.toContain("world_dispatcher");
  });

  it("merges duplicate resource_systems entries", () => {
    const policies = buildPolicies("mainnet");
    const resource = Object.entries(policies.contracts).find(([_, v]) =>
      v.methods.some((m) => m.entrypoint === "deposit"),
    );
    expect(resource).toBeDefined();
    const methods = resource![1].methods.map((m) => m.entrypoint);
    // From first entry
    expect(methods).toContain("deposit");
    expect(methods).toContain("withdraw");
    // From second entry
    expect(methods).toContain("approve");
    expect(methods).toContain("send");
    expect(methods).toContain("troop_burn");
  });

  it("includes entry/fee token policies when provided", () => {
    const policies = buildPolicies("mainnet", {
      entryToken: "0xENTRY",
      feeToken: "0xFEE",
    });
    expect(policies.contracts["0xENTRY"]).toBeDefined();
    expect(policies.contracts["0xENTRY"].methods[0].entrypoint).toBe(
      "token_lock",
    );
    expect(policies.contracts["0xFEE"]).toBeDefined();
    expect(policies.contracts["0xFEE"].methods[0].entrypoint).toBe("approve");
  });

  it("skips entry token when address is 0x0", () => {
    const policies = buildPolicies("mainnet", { entryToken: "0x0" });
    expect(policies.contracts["0x0"]).toBeUndefined();
  });

  it("throws for invalid chain", () => {
    expect(() => buildPolicies("invalid" as any)).toThrow();
  });
});
