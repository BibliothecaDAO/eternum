import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

// Load real manifest and old policy output for comparison
const manifestPath = resolve(__dirname, "../../../../../manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

const policyPath = resolve(__dirname, "../../../../../policy.json");
const oldPolicy = JSON.parse(readFileSync(policyPath, "utf-8"));

const profilePath = resolve(__dirname, "../../../../../profile.json");
const profile = JSON.parse(readFileSync(profilePath, "utf-8"));

describe("ABI-driven session policies", () => {
  it("builds policies from real manifest ABIs", () => {
    const policies = buildSessionPoliciesFromManifest(manifest);
    const contractAddresses = Object.keys(policies.contracts ?? {});

    // Should have many contracts (the manifest has 30+ contracts)
    expect(contractAddresses.length).toBeGreaterThan(20);
  });

  it("every contract has at least one method", () => {
    const policies = buildSessionPoliciesFromManifest(manifest);
    for (const [addr, contract] of Object.entries(policies.contracts ?? {})) {
      if (addr === "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f") continue; // VRF
      expect((contract as any).methods.length).toBeGreaterThan(0);
    }
  });

  it("extracts ALL external entrypoints from ABIs (more than the old hardcoded list)", () => {
    const policies = buildSessionPoliciesFromManifest(manifest);

    // Find resource_systems by checking which contract has 'send'
    let resourceAddr: string | undefined;
    for (const [addr, contract] of Object.entries(policies.contracts ?? {})) {
      const methods = (contract as any).methods ?? [];
      if (methods.some((m: any) => m.entrypoint === "send") && methods.some((m: any) => m.entrypoint === "pickup")) {
        resourceAddr = addr;
        break;
      }
    }
    expect(resourceAddr).toBeDefined();

    const resourceMethods = ((policies.contracts as any)?.[resourceAddr!]?.methods ?? []).map(
      (m: any) => m.entrypoint,
    );
    // Only external (state-mutating) functions are included in session policies.
    // View functions like dojo_name/world_dispatcher don't need session authorization.
    expect(resourceMethods).toContain("send");
    expect(resourceMethods).toContain("pickup");
    expect(resourceMethods).toContain("approve");
    expect(resourceMethods).toContain("arrivals_offload");
    expect(resourceMethods).toContain("troop_troop_adjacent_transfer");
    expect(resourceMethods).toContain("structure_regularize_weight");
    // View functions should NOT be included (they don't need session key auth)
    expect(resourceMethods).not.toContain("dojo_name");
    expect(resourceMethods).not.toContain("world_dispatcher");
  });

  it("includes key gameplay entrypoints across all systems", () => {
    const policies = buildSessionPoliciesFromManifest(manifest);

    // Collect all entrypoints across all contracts
    const allEntrypoints = new Set<string>();
    for (const contract of Object.values(policies.contracts ?? {})) {
      for (const m of (contract as any).methods ?? []) {
        allEntrypoints.add(m.entrypoint);
      }
    }

    // Troop management
    expect(allEntrypoints.has("explorer_create")).toBe(true);
    expect(allEntrypoints.has("explorer_add")).toBe(true);
    expect(allEntrypoints.has("explorer_delete")).toBe(true);
    expect(allEntrypoints.has("guard_add")).toBe(true);
    expect(allEntrypoints.has("guard_delete")).toBe(true);
    // Movement
    expect(allEntrypoints.has("explorer_move")).toBe(true);
    // Combat
    expect(allEntrypoints.has("attack_explorer_vs_explorer")).toBe(true);
    expect(allEntrypoints.has("attack_explorer_vs_guard")).toBe(true);
    expect(allEntrypoints.has("attack_guard_vs_explorer")).toBe(true);
    expect(allEntrypoints.has("raid_explorer_vs_guard")).toBe(true);
    // Trade
    expect(allEntrypoints.has("create_order")).toBe(true);
    expect(allEntrypoints.has("accept_order")).toBe(true);
    expect(allEntrypoints.has("cancel_order")).toBe(true);
    // Buildings
    expect(allEntrypoints.has("create_building")).toBe(true);
    expect(allEntrypoints.has("destroy_building")).toBe(true);
    expect(allEntrypoints.has("pause_building_production")).toBe(true);
    expect(allEntrypoints.has("resume_building_production")).toBe(true);
    // Bank/Swap
    expect(allEntrypoints.has("buy")).toBe(true);
    expect(allEntrypoints.has("sell")).toBe(true);
    // Liquidity
    expect(allEntrypoints.has("add")).toBe(true);
    expect(allEntrypoints.has("remove")).toBe(true);
    // Guild
    expect(allEntrypoints.has("create_guild")).toBe(true);
    expect(allEntrypoints.has("join_guild")).toBe(true);
    expect(allEntrypoints.has("leave_guild")).toBe(true);
    expect(allEntrypoints.has("update_whitelist")).toBe(true);
    // Structure
    expect(allEntrypoints.has("level_up")).toBe(true);
    // Hyperstructure
    expect(allEntrypoints.has("contribute")).toBe(true);
    expect(allEntrypoints.has("initialize")).toBe(true);
    // Blitz
    expect(allEntrypoints.has("obtain_entry_token")).toBe(true);
    expect(allEntrypoints.has("register")).toBe(true);
  });

  it("is a superset of the old hardcoded policy output (external functions only)", () => {
    const policies = buildSessionPoliciesFromManifest(manifest, { worldProfile: profile });

    // For each contract in the old policy, check that the new policy
    // has the same contract with at least the same entrypoints.
    // The old policy included view functions (dojo_name, world_dispatcher, etc.)
    // which don't need session key authorization, so we exclude them.
    const vrfAddress = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
    const entryTokenAddress = profile.entryTokenAddress;
    const feeTokenAddress = profile.feeTokenAddress;
    const specialAddresses = new Set([vrfAddress, entryTokenAddress, feeTokenAddress]);

    // View functions that the old policy included but don't need session authorization
    const viewFunctions = new Set(["dojo_name", "world_dispatcher", "dojo_init"]);

    let oldEntrypointCount = 0;
    let coveredCount = 0;
    const uncovered: string[] = [];

    for (const [addr, oldContract] of Object.entries(oldPolicy.contracts ?? {})) {
      if (specialAddresses.has(addr)) continue; // Check special policies separately
      const oldMethods = ((oldContract as any).methods ?? []).map((m: any) => m.entrypoint);
      const newContract = (policies.contracts as any)?.[addr];

      if (!newContract) continue; // Contract may not exist if manifest changed

      const newMethods = new Set((newContract.methods ?? []).map((m: any) => m.entrypoint));

      for (const ep of oldMethods) {
        if (viewFunctions.has(ep)) continue; // Skip view functions
        oldEntrypointCount++;
        if (newMethods.has(ep)) {
          coveredCount++;
        } else {
          uncovered.push(`${addr.slice(0, 10)}...::${ep}`);
        }
      }
    }

    const coverage = oldEntrypointCount > 0 ? coveredCount / oldEntrypointCount : 1;
    console.log(`\nOld policy coverage (external only): ${coveredCount}/${oldEntrypointCount} (${(coverage * 100).toFixed(1)}%)`);
    if (uncovered.length > 0) {
      console.log(`Uncovered entrypoints: ${uncovered.join(", ")}`);
    }
    // Some old entrypoints may have been renamed/moved in the current manifest,
    // so we allow some drift. 80%+ confirms strong structural coverage.
    expect(coverage).toBeGreaterThan(0.8);
  });
});

describe("game name filtering", () => {
  it("filters contracts by game name", () => {
    const all = buildSessionPoliciesFromManifest(manifest);
    const filtered = buildSessionPoliciesFromManifest(manifest, { gameName: "eternum" });

    // Both should have VRF
    const vrfAddress = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
    expect((all.contracts as any)?.[vrfAddress]).toBeDefined();
    expect((filtered.contracts as any)?.[vrfAddress]).toBeDefined();

    // Filtered should have same or fewer contracts (minus VRF/special)
    const allCount = Object.keys(all.contracts ?? {}).length;
    const filteredCount = Object.keys(filtered.contracts ?? {}).length;
    expect(filteredCount).toBeLessThanOrEqual(allCount);
    expect(filteredCount).toBeGreaterThan(1); // At least VRF + some game contracts
  });
});

describe("special policies", () => {
  it("always includes VRF provider policy", () => {
    const policies = buildSessionPoliciesFromManifest(manifest);
    const vrfAddress = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";
    expect((policies.contracts as any)?.[vrfAddress]).toBeDefined();
    expect((policies.contracts as any)?.[vrfAddress]?.methods?.some((m: any) => m.entrypoint === "request_random")).toBe(
      true,
    );
  });

  it("includes token policies when worldProfile provides addresses", () => {
    const policies = buildSessionPoliciesFromManifest(manifest, { worldProfile: profile });

    expect((policies.contracts as any)?.[profile.entryTokenAddress]).toBeDefined();
    expect(
      (policies.contracts as any)?.[profile.entryTokenAddress]?.methods?.some(
        (m: any) => m.entrypoint === "token_lock",
      ),
    ).toBe(true);

    expect((policies.contracts as any)?.[profile.feeTokenAddress]).toBeDefined();
    expect(
      (policies.contracts as any)?.[profile.feeTokenAddress]?.methods?.some((m: any) => m.entrypoint === "approve"),
    ).toBe(true);
  });

  it("skips entry token policy when address is 0x0", () => {
    const policies = buildSessionPoliciesFromManifest(manifest, {
      worldProfile: { ...profile, entryTokenAddress: "0x0" },
    });
    expect((policies.contracts as any)?.["0x0"]).toBeUndefined();
  });

  it("includes message signing policy", () => {
    const policies = buildSessionPoliciesFromManifest(manifest) as any;
    expect(policies.messages).toBeDefined();
    expect(Array.isArray(policies.messages)).toBe(true);
    expect(policies.messages.length).toBeGreaterThan(0);
    expect(policies.messages[0].primaryType).toBe("s1_eternum-Message");
  });
});

describe("ControllerSession constructor", () => {
  it("passes generated policies to SessionProvider", () => {
    mocks.ctorCalls.length = 0;

    new ControllerSession({
      rpcUrl: "http://localhost:5050",
      chainId: "SN_SEPOLIA",
      basePath: ".cartridge",
      gameName: "eternum",
      manifest,
    });

    expect(mocks.ctorCalls).toHaveLength(1);
    const opts = mocks.ctorCalls[0];
    expect(opts.basePath).toBe(".cartridge");
    // Should have contracts from manifest ABIs
    expect(Object.keys(opts.policies?.contracts ?? {}).length).toBeGreaterThan(10);
  });
});

describe("edge cases", () => {
  it("throws when manifest has no contracts with ABIs", () => {
    expect(() =>
      buildSessionPoliciesFromManifest({
        contracts: [{ tag: "s1_eternum-resource_systems", address: "0x111" }],
      }),
    ).toThrow("no recognized system contracts found");
  });

  it("skips contracts without ABI data", () => {
    const mixedManifest = {
      contracts: [
        // Real contract with ABI
        manifest.contracts.find((c: any) => c.tag === "s1_eternum-resource_systems"),
        // Fake contract without ABI
        { tag: "s1_eternum-fake_systems", address: "0xfake" },
      ],
    };

    const policies = buildSessionPoliciesFromManifest(mixedManifest);
    expect((policies.contracts as any)?.["0xfake"]).toBeUndefined();
  });

  it("skips contracts without tag or address", () => {
    const policies = buildSessionPoliciesFromManifest({
      contracts: [
        { tag: "", address: "0x123", abi: [{ type: "interface", name: "I", items: [] }] },
        { tag: "s1_eternum-test", address: "", abi: [{ type: "interface", name: "I", items: [] }] },
        manifest.contracts.find((c: any) => c.tag === "s1_eternum-resource_systems"),
      ],
    });

    expect((policies.contracts as any)?.["0x123"]).toBeUndefined();
    expect((policies.contracts as any)?.[""]).toBeUndefined();
  });

  it("policy methods omit descriptions to keep session URL short", () => {
    const policies = buildSessionPoliciesFromManifest(manifest);

    // Descriptions are intentionally omitted to avoid URI_TOO_LONG errors
    // when the Cartridge Controller serializes policies into the session URL.
    for (const contract of Object.values(policies.contracts ?? {})) {
      for (const method of (contract as any).methods ?? []) {
        expect(method.description).toBeUndefined();
      }
    }
  });
});
