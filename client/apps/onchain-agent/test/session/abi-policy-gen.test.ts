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

const manifestPath = resolve(__dirname, "../../../../../contracts/game/manifest_slot.json");
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

