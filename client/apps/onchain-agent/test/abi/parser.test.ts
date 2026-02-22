import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "starknet";
import { describe, expect, it } from "vitest";
import {
  simplifyType,
  extractFromABI,
  extractAllFromManifest,
  getGameEntrypoints,
  tagMatchesGame,
  abiTypeToParamSchemaType,
} from "../../src/abi/parser";

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
  const resourceSystems = manifest.contracts.find((c: any) => c.tag === "s1_eternum-resource_systems");

  it("extracts game-specific external entrypoints", () => {
    const { entrypoints } = extractFromABI(resourceSystems.abi);
    const gameExternal = entrypoints.filter((e) => !e.isFramework && e.state_mutability === "external");
    const names = gameExternal.map((e) => e.name);
    expect(names).toContain("approve");
    expect(names).toContain("send");
    expect(names).toContain("pickup");
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
      expect(ep.selector).toBe(hash.getSelectorFromName(ep.name));
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
  });

  it("preserves contract addresses", () => {
    const results = extractAllFromManifest(manifest);
    for (const r of results) {
      expect(r.address).toBeTruthy();
      expect(r.address.startsWith("0x")).toBe(true);
    }
  });
});

describe("getGameEntrypoints", () => {
  it("filters to non-framework external entrypoints", () => {
    const results = extractAllFromManifest(manifest);
    const resource = results.find((r) => r.suffix === "resource_systems")!;
    const game = getGameEntrypoints(resource);

    expect(game.length).toBeGreaterThan(0);
    for (const ep of game) {
      expect(ep.isFramework).toBe(false);
      expect(ep.state_mutability).toBe("external");
    }
  });
});

describe("tagMatchesGame", () => {
  it("matches when gameName is null (all games)", () => {
    expect(tagMatchesGame("s1_eternum-resource_systems", null)).toBe(true);
  });

  it("matches correct game prefix", () => {
    expect(tagMatchesGame("s1_eternum-resource_systems", "eternum")).toBe(true);
  });

  it("rejects non-matching game prefix", () => {
    expect(tagMatchesGame("s1_eternum-resource_systems", "othergame")).toBe(false);
  });
});

describe("abiTypeToParamSchemaType", () => {
  it("maps integer types to number", () => {
    expect(abiTypeToParamSchemaType("core::integer::u8")).toBe("number");
    expect(abiTypeToParamSchemaType("core::integer::u16")).toBe("number");
    expect(abiTypeToParamSchemaType("core::integer::u32")).toBe("number");
    expect(abiTypeToParamSchemaType("core::integer::u64")).toBe("number");
  });

  it("maps large integers to bigint", () => {
    expect(abiTypeToParamSchemaType("core::integer::u128")).toBe("bigint");
    expect(abiTypeToParamSchemaType("core::integer::u256")).toBe("bigint");
  });

  it("maps string-like types to string", () => {
    expect(abiTypeToParamSchemaType("core::felt252")).toBe("string");
    expect(abiTypeToParamSchemaType("core::starknet::contract_address::ContractAddress")).toBe("string");
    expect(abiTypeToParamSchemaType("core::byte_array::ByteArray")).toBe("string");
  });

  it("maps bool to boolean", () => {
    expect(abiTypeToParamSchemaType("core::bool")).toBe("boolean");
  });

  it("maps array types to object[]", () => {
    // Real manifest uses capitalized module paths: core::array::Span::
    expect(abiTypeToParamSchemaType("core::array::Span::<(core::integer::u8, core::integer::u128)>")).toBe("object[]");
    expect(abiTypeToParamSchemaType("core::array::Array::<core::integer::u32>")).toBe("object[]");
  });

  it("maps game enums to number", () => {
    expect(abiTypeToParamSchemaType("s1_eternum::models::troop::TroopType")).toBe("number");
  });
});
