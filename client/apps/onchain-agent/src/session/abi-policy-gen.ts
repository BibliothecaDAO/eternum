/**
 * ABI-driven policy generation from manifest data.
 *
 * Parses Starknet/Dojo contract ABIs to automatically extract:
 * - External entrypoints (for session policies)
 * - Typed parameter schemas (for action descriptions)
 * - Computed selectors (sn_keccak of function names)
 */
import { hash } from "starknet";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ABIParam {
  name: string;
  type: string;
  rawType: string;
}

export interface ABIEntrypoint {
  name: string;
  selector: string;
  state_mutability: "external" | "view";
  isFramework: boolean;
  interfaceName: string;
  params: ABIParam[];
  outputs: ABIParam[];
  signature: string;
}

export interface ABIStruct {
  name: string;
  members: ABIParam[];
}

export interface ContractABIResult {
  tag: string;
  suffix: string;
  address: string;
  contractSelector: string;
  entrypoints: ABIEntrypoint[];
  structs: Map<string, ABIParam[]>;
}

export interface PolicyMethod {
  name: string;
  entrypoint: string;
  selector: string;
  description: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

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

interface ManifestContract {
  tag?: string;
  address?: string;
  selector?: string;
  abi?: unknown[];
}

export function extractAllFromManifest(manifest: { contracts?: ManifestContract[] }): ContractABIResult[] {
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

// ── Policy generation ────────────────────────────────────────────────────────

export interface GeneratedPolicies {
  /** Contract address → policy methods */
  contracts: Record<string, { methods: PolicyMethod[] }>;
  /** Which suffixes were found and processed */
  coverage: Map<string, string[]>;
}

export function generatePoliciesFromManifest(
  manifest: { contracts?: ManifestContract[] },
  options: {
    /** Include framework entrypoints like upgrade, dojo_name, world_dispatcher */
    includeFramework?: boolean;
    /** Only include external (state-changing) functions, not view functions */
    externalOnly?: boolean;
    /** Filter to specific game name prefix */
    gameName?: string;
  } = {},
): GeneratedPolicies {
  const { includeFramework = false, externalOnly = true, gameName } = options;

  const contracts: Record<string, { methods: PolicyMethod[] }> = {};
  const coverage = new Map<string, string[]>();
  const allResults = extractAllFromManifest(manifest);

  for (const result of allResults) {
    if (gameName) {
      const pattern = new RegExp(`(?:^|_)${gameName}-`);
      if (!pattern.test(result.tag)) continue;
    }

    const methods: PolicyMethod[] = [];
    for (const ep of result.entrypoints) {
      if (!includeFramework && ep.isFramework) continue;
      if (externalOnly && ep.state_mutability !== "external") continue;

      methods.push({
        name: ep.name,
        entrypoint: ep.name,
        selector: ep.selector,
        description: ep.signature,
      });
    }

    if (methods.length > 0 && result.address) {
      contracts[result.address] = { methods };
      coverage.set(result.suffix, methods.map((m) => m.entrypoint));
    }
  }

  return { contracts, coverage };
}
