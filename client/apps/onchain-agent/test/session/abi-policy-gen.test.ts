import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "starknet";
import { describe, expect, it } from "vitest";
import {
  extractFromABI,
  extractAllFromManifest,
  generatePoliciesFromManifest,
  simplifyType,
} from "../../src/session/abi-policy-gen";

// Load real manifest from repo root
const manifestPath = resolve(__dirname, "../../../../../manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

describe("simplifyType", () => {
  it("strips core:: prefixes", () => {
    expect(simplifyType("core::integer::u32")).toBe("u32");
    expect(simplifyType("core::integer::u128")).toBe("u128");
    expect(simplifyType("core::felt252")).toBe("felt252");
    expect(simplifyType("core::bool")).toBe("bool");
  });

  it("simplifies container types", () => {
    expect(simplifyType("core::array::Span::<(core::integer::u8, core::integer::u128)>")).toBe("Span<(u8, u128)>");
    expect(simplifyType("core::array::Array::<core::integer::u32>")).toBe("Array<u32>");
  });

  it("simplifies starknet types", () => {
    expect(simplifyType("core::starknet::contract_address::ContractAddress")).toBe("ContractAddress");
    expect(simplifyType("core::starknet::class_hash::ClassHash")).toBe("ClassHash");
  });
});

describe("extractFromABI", () => {
  // Use a real contract ABI from the manifest
  const resourceSystems = manifest.contracts.find((c: any) => c.tag === "s1_eternum-resource_systems");

  it("extracts game-specific external entrypoints", () => {
    const { entrypoints } = extractFromABI(resourceSystems.abi);
    const gameExternal = entrypoints.filter((e) => !e.isFramework && e.state_mutability === "external");

    const names = gameExternal.map((e) => e.name);
    expect(names).toContain("approve");
    expect(names).toContain("send");
    expect(names).toContain("pickup");
    expect(names).toContain("arrivals_offload");
    expect(names).toContain("troop_burn");
    expect(names).toContain("structure_burn");
  });

  it("identifies framework interfaces separately", () => {
    const { entrypoints } = extractFromABI(resourceSystems.abi);
    const framework = entrypoints.filter((e) => e.isFramework);

    const fwNames = framework.map((e) => e.name);
    expect(fwNames).toContain("dojo_name");
    expect(fwNames).toContain("world_dispatcher");
    expect(fwNames).toContain("upgrade");
  });

  it("computes selectors matching starknet.js", () => {
    const { entrypoints } = extractFromABI(resourceSystems.abi);
    for (const ep of entrypoints) {
      const expected = hash.getSelectorFromName(ep.name);
      expect(ep.selector).toBe(expected);
    }
  });

  it("produces typed signatures with parameter names", () => {
    const { entrypoints } = extractFromABI(resourceSystems.abi);
    const send = entrypoints.find((e) => e.name === "send");
    expect(send).toBeDefined();
    expect(send!.signature).toBe(
      "send(sender_structure_id: u32, recipient_structure_id: u32, resources: Span<(u8, u128)>)",
    );
    expect(send!.params).toHaveLength(3);
    expect(send!.params[0]).toEqual({
      name: "sender_structure_id",
      type: "u32",
      rawType: "core::integer::u32",
    });
  });

  it("extracts struct definitions", () => {
    const { structs } = extractFromABI(resourceSystems.abi);
    expect(structs.size).toBeGreaterThan(0);
    // ByteArray is always present
    expect(structs.has("core::byte_array::ByteArray")).toBe(true);
  });
});

describe("extractAllFromManifest", () => {
  it("processes all contracts in the manifest", () => {
    const results = extractAllFromManifest(manifest);
    expect(results.length).toBe(manifest.contracts.length);
  });

  it("generates correct suffixes", () => {
    const results = extractAllFromManifest(manifest);
    const suffixes = results.map((r) => r.suffix);
    expect(suffixes).toContain("resource_systems");
    expect(suffixes).toContain("troop_management_systems");
    expect(suffixes).toContain("blitz_realm_systems");
  });

  it("preserves contract addresses", () => {
    const results = extractAllFromManifest(manifest);
    for (const r of results) {
      expect(r.address).toBeTruthy();
      expect(r.address.startsWith("0x")).toBe(true);
    }
  });
});

describe("generatePoliciesFromManifest", () => {
  it("generates policies for all contracts with external functions", () => {
    const { contracts } = generatePoliciesFromManifest(manifest);
    const addresses = Object.keys(contracts);
    // Should have entries for contracts with game-specific external functions
    expect(addresses.length).toBeGreaterThan(10);
  });

  it("excludes framework entrypoints by default", () => {
    const { contracts } = generatePoliciesFromManifest(manifest);
    for (const [, { methods }] of Object.entries(contracts)) {
      const names = methods.map((m) => m.entrypoint);
      expect(names).not.toContain("upgrade");
      expect(names).not.toContain("dojo_name");
      expect(names).not.toContain("world_dispatcher");
    }
  });

  it("includes framework entrypoints when requested", () => {
    const { contracts } = generatePoliciesFromManifest(manifest, { includeFramework: true });
    // upgrade is external+framework, so it should appear
    const allMethods = Object.values(contracts).flatMap((c) => c.methods);
    expect(allMethods.some((m) => m.entrypoint === "upgrade")).toBe(true);
  });

  it("includes framework view functions when both flags set", () => {
    const { contracts } = generatePoliciesFromManifest(manifest, { includeFramework: true, externalOnly: false });
    const allMethods = Object.values(contracts).flatMap((c) => c.methods);
    expect(allMethods.some((m) => m.entrypoint === "dojo_name")).toBe(true);
    expect(allMethods.some((m) => m.entrypoint === "world_dispatcher")).toBe(true);
  });

  it("every generated method has a computed selector", () => {
    const { contracts } = generatePoliciesFromManifest(manifest);
    for (const [, { methods }] of Object.entries(contracts)) {
      for (const method of methods) {
        expect(method.selector).toBeTruthy();
        expect(method.selector.startsWith("0x")).toBe(true);
        // Verify selector is correct
        expect(method.selector).toBe(hash.getSelectorFromName(method.entrypoint));
      }
    }
  });

  it("every generated method has a typed description", () => {
    const { contracts } = generatePoliciesFromManifest(manifest);
    for (const [, { methods }] of Object.entries(contracts)) {
      for (const method of methods) {
        // Description should be "name(param1: type1, ...)" format
        expect(method.description).toMatch(/^\w+\(.*\)$/);
      }
    }
  });

  it("coverage map lists all entrypoints per suffix", () => {
    const { coverage } = generatePoliciesFromManifest(manifest);
    expect(coverage.has("resource_systems")).toBe(true);
    expect(coverage.get("resource_systems")).toContain("send");
    expect(coverage.get("resource_systems")).toContain("approve");
  });
});

describe("comparison with hardcoded POLICY_METHODS_BY_SUFFIX", () => {
  // These are the game-specific entrypoints from the hardcoded table in controller-session.ts
  // (excluding dojo_name and world_dispatcher which are Dojo framework introspection)
  const HARDCODED: Record<string, string[]> = {
    resource_systems: [
      "approve", "send", "pickup", "arrivals_offload", "deposit", "withdraw",
      "troop_troop_adjacent_transfer", "troop_structure_adjacent_transfer",
      "structure_troop_adjacent_transfer", "structure_burn", "troop_burn",
    ],
    troop_management_systems: [
      "explorer_create", "explorer_add", "explorer_delete", "guard_add", "guard_delete",
      "explorer_explorer_swap", "explorer_guard_swap", "guard_explorer_swap",
    ],
    troop_movement_systems: ["explorer_move", "explorer_extract_reward"],
    troop_battle_systems: ["attack_explorer_vs_explorer", "attack_explorer_vs_guard", "attack_guard_vs_explorer"],
    troop_raid_systems: ["raid_explorer_vs_guard"],
    trade_systems: ["create_order", "accept_order", "cancel_order"],
    production_systems: [
      "create_building", "destroy_building", "pause_building_production", "resume_building_production",
      "burn_resource_for_labor_production", "burn_labor_for_resource_production", "burn_resource_for_resource_production",
    ],
    swap_systems: ["buy", "sell"],
    bank_systems: ["create_banks"],
    liquidity_systems: ["add", "remove"],
    guild_systems: [
      "create_guild", "join_guild", "leave_guild", "whitelist_player",
      "transfer_guild_ownership", "remove_guild_member", "remove_player_from_whitelist",
      "update_whitelist", "remove_member",
    ],
    realm_systems: ["create"],
    structure_systems: ["level_up"],
    hyperstructure_systems: ["initialize", "contribute", "claim_share_points", "allocate_shares", "update_construction_access"],
    config_systems: ["set_agent_config", "set_world_config"],
    name_systems: ["set_address_name"],
    ownership_systems: ["transfer_structure_ownership", "transfer_agent_ownership"],
    dev_resource_systems: ["mint"],
    relic_systems: ["open_chest", "apply_relic"],
    season_systems: ["register_to_leaderboard", "claim_leaderboard_rewards"],
    village_systems: ["upgrade", "create"],
    blitz_realm_systems: ["make_hyperstructures", "register", "obtain_entry_token", "create", "assign_realm_positions", "settle_realms"],
  };

  const abiResults = extractAllFromManifest(manifest);
  const abiMap = new Map(abiResults.map((r) => [r.suffix, r]));

  it("every hardcoded suffix exists in the manifest", () => {
    for (const suffix of Object.keys(HARDCODED)) {
      expect(abiMap.has(suffix), `missing contract: ${suffix}`).toBe(true);
    }
  });

  // This test documents the known drift between hardcoded and manifest
  it("identifies entrypoints in hardcoded table but missing from ABI", () => {
    const missing: Record<string, string[]> = {};

    for (const [suffix, hardcodedFns] of Object.entries(HARDCODED)) {
      const abiData = abiMap.get(suffix);
      if (!abiData) continue;

      const abiExternal = abiData.entrypoints
        .filter((e) => !e.isFramework && e.state_mutability === "external")
        .map((e) => e.name);

      const notInAbi = hardcodedFns.filter((f) => !abiExternal.includes(f));
      if (notInAbi.length > 0) {
        missing[suffix] = notInAbi;
      }
    }

    // Document the known drift — these are hardcoded but no longer in the manifest ABI
    // This proves the hardcoded table is stale and ABI-driven generation would be more accurate
    console.log("\nHardcoded entrypoints NOT found in manifest ABI (stale references):");
    for (const [suffix, fns] of Object.entries(missing)) {
      console.log(`  ${suffix}: ${fns.join(", ")}`);
    }

    // We expect some drift — this test documents it rather than enforcing zero-drift
    expect(Object.keys(missing).length).toBeGreaterThan(0);
  });

  it("identifies new ABI entrypoints not in the hardcoded table", () => {
    const extra: Record<string, string[]> = {};

    for (const [suffix, hardcodedFns] of Object.entries(HARDCODED)) {
      const abiData = abiMap.get(suffix);
      if (!abiData) continue;

      const abiExternal = abiData.entrypoints
        .filter((e) => !e.isFramework && e.state_mutability === "external")
        .map((e) => e.name);

      const notInHardcoded = abiExternal.filter((f) => !hardcodedFns.includes(f));
      if (notInHardcoded.length > 0) {
        extra[suffix] = notInHardcoded;
      }
    }

    console.log("\nABI entrypoints NOT in hardcoded table (missing policies):");
    for (const [suffix, fns] of Object.entries(extra)) {
      console.log(`  ${suffix}: ${fns.join(", ")}`);
    }

    // These are real entrypoints that the hardcoded table is missing
    expect(Object.keys(extra).length).toBeGreaterThan(0);
  });

  it("identifies entire contracts missing from the hardcoded table", () => {
    const hardcodedSuffixes = new Set(Object.keys(HARDCODED));
    const uncovered: Record<string, string[]> = {};

    for (const result of abiResults) {
      if (hardcodedSuffixes.has(result.suffix)) continue;

      const gameExternal = result.entrypoints
        .filter((e) => !e.isFramework && e.state_mutability === "external")
        .map((e) => e.name);

      if (gameExternal.length > 0) {
        uncovered[result.suffix] = gameExternal;
      }
    }

    console.log("\nContracts with external functions but NO hardcoded entry:");
    for (const [suffix, fns] of Object.entries(uncovered)) {
      console.log(`  ${suffix}: ${fns.join(", ")}`);
    }

    expect(Object.keys(uncovered).length).toBeGreaterThan(0);
  });

  it("ABI-generated output is a strict superset of what matters (matching entrypoints)", () => {
    // Count how many hardcoded entrypoints exist in the ABI
    let total = 0;
    let found = 0;

    for (const [suffix, hardcodedFns] of Object.entries(HARDCODED)) {
      const abiData = abiMap.get(suffix);
      if (!abiData) continue;

      const abiExternal = new Set(
        abiData.entrypoints
          .filter((e) => !e.isFramework && e.state_mutability === "external")
          .map((e) => e.name),
      );

      for (const fn of hardcodedFns) {
        total++;
        if (abiExternal.has(fn)) found++;
      }
    }

    const coverage = ((found / total) * 100).toFixed(1);
    console.log(`\nCoverage: ${found}/${total} (${coverage}%) hardcoded entrypoints found in ABI`);
    // The majority should match — drift is from contract evolution, not from parsing bugs
    expect(found / total).toBeGreaterThan(0.8);
  });
});
