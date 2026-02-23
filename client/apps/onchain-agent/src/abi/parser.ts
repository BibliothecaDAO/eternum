/**
 * ABI parser for Starknet/Dojo contract manifests.
 *
 * Extracts entrypoints, parameter schemas, struct definitions, and computed
 * selectors from manifest ABI data. Used by both the policy generator and
 * the action generator.
 */
import { hash } from "starknet";
import type { ABIEntrypoint, ABIParam, ContractABIResult, Manifest, ManifestContract } from "./types";

// ── Dojo framework interface names to filter ─────────────────────────────────

const DOJO_FRAMEWORK_IFACES = new Set([
  "dojo::contract::interface::IContract",
  "dojo::meta::interface::IDeployedResource",
  "dojo::contract::components::world_provider::IWorldProvider",
  "dojo::contract::components::upgradeable::IUpgradeable",
]);

// ── Type simplification ──────────────────────────────────────────────────────

export function simplifyType(fullType: string): string {
  return fullType
    .replace(/core::integer::/g, "")
    .replace(/core::felt252/g, "felt252")
    .replace(/core::starknet::contract_address::ContractAddress/g, "ContractAddress")
    .replace(/core::starknet::class_hash::ClassHash/g, "ClassHash")
    .replace(/core::array::Array::</g, "Array<")
    .replace(/core::array::Span::</g, "Span<")
    .replace(/core::bool/g, "bool")
    .replace(/core::byte_array::ByteArray/g, "ByteArray");
}

// ── ABI parsing ──────────────────────────────────────────────────────────────

export function extractFromABI(abi: unknown[]): { entrypoints: ABIEntrypoint[]; structs: Map<string, ABIParam[]> } {
  const entrypoints: ABIEntrypoint[] = [];
  const structs = new Map<string, ABIParam[]>();

  for (const entry of abi as any[]) {
    if (entry.type === "struct" && entry.members) {
      structs.set(
        entry.name,
        entry.members.map((m: any) => ({
          name: m.name,
          type: simplifyType(m.type),
          rawType: m.type,
        })),
      );
    }

    if (entry.type !== "interface") continue;

    const isFramework = DOJO_FRAMEWORK_IFACES.has(entry.name);

    for (const item of entry.items || []) {
      if (item.type !== "function") continue;

      const params: ABIParam[] = (item.inputs || []).map((p: any) => ({
        name: p.name,
        type: simplifyType(p.type),
        rawType: p.type,
      }));

      const outputs: ABIParam[] = (item.outputs || []).map((o: any) => ({
        type: simplifyType(o.type),
        rawType: o.type,
        name: "",
      }));

      entrypoints.push({
        name: item.name,
        selector: hash.getSelectorFromName(item.name),
        state_mutability: item.state_mutability,
        isFramework,
        interfaceName: entry.name,
        params,
        outputs,
        signature: `${item.name}(${params.map((p) => `${p.name}: ${p.type}`).join(", ")})`,
      });
    }
  }

  return { entrypoints, structs };
}

// ── Manifest-level extraction ────────────────────────────────────────────────

export function extractAllFromManifest(manifest: Manifest): ContractABIResult[] {
  const results: ContractABIResult[] = [];

  for (const contract of manifest.contracts || []) {
    const tag = contract.tag ?? "";
    const suffix = tag.replace(/^s\d+_\w+-/, "");
    const { entrypoints, structs } = extractFromABI(contract.abi || []);

    results.push({
      tag,
      suffix,
      address: contract.address ?? "",
      contractSelector: contract.selector ?? "",
      entrypoints,
      structs,
    });
  }

  return results;
}

// ── Helpers for consumers ────────────────────────────────────────────────────

/** Get only game-specific external entrypoints for a contract (filters Dojo framework). */
export function getGameEntrypoints(result: ContractABIResult): ABIEntrypoint[] {
  return result.entrypoints.filter((e) => !e.isFramework && e.state_mutability === "external");
}

/** Check if a tag matches a specific game name. */
export function tagMatchesGame(tag: string, gameName: string | null): boolean {
  if (!gameName) return true;
  const escaped = gameName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|_)${escaped}-`);
  return pattern.test(tag);
}

/** Map a raw ABI type to the ActionParamSchema type used by game-agent. */
export function abiTypeToParamSchemaType(
  rawType: string,
  structNames?: Set<string>,
): "number" | "string" | "boolean" | "number[]" | "object[]" | "object" | "bigint" {
  if (rawType === "core::bool") return "boolean";

  if (
    rawType === "core::integer::u8" ||
    rawType === "core::integer::u16" ||
    rawType === "core::integer::u32" ||
    rawType === "core::integer::u64"
  ) {
    return "number";
  }

  if (rawType === "core::integer::u128" || rawType === "core::integer::u256") {
    return "bigint";
  }

  if (rawType === "core::felt252") return "string";
  if (rawType === "core::starknet::contract_address::ContractAddress") return "string";
  if (rawType === "core::starknet::class_hash::ClassHash") return "string";
  if (rawType === "core::byte_array::ByteArray") return "string";

  // Arrays and Spans
  if (rawType.startsWith("core::array::Span::") || rawType.startsWith("core::array::Array::")) {
    return "object[]";
  }

  // Struct types → "object" (single object, not an array)
  if (structNames?.has(rawType)) return "object";

  // Game-specific enums (e.g., s1_eternum::models::troop::TroopType) → number (variant index)
  // Tuples → object[]
  if (rawType.includes("::")) return "number";

  return "string";
}

/**
 * Build a human-readable description of a struct's fields for the LLM.
 * Returns null if the type is not a known struct.
 */
export function describeStructFields(
  rawType: string,
  structs: Map<string, ABIParam[]>,
): string | null {
  const fields = structs.get(rawType);
  if (!fields) return null;
  const fieldDescs = fields.map((f) => `${f.name}: ${f.type}`).join(", ");
  return `{${fieldDescs}}`;
}
