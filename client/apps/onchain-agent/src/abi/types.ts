/**
 * Shared types for the ABI-driven pipeline.
 */

// ── ABI extraction types ─────────────────────────────────────────────────────

export interface ABIParam {
  name: string;
  /** Simplified type (e.g., "u32", "Span<(u8, u128)>") */
  type: string;
  /** Raw ABI type (e.g., "core::integer::u32") */
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
  /** Human-readable signature: "send(sender_structure_id: u32, ...)" */
  signature: string;
}

export interface ContractABIResult {
  tag: string;
  /** Tag with namespace prefix stripped (e.g., "resource_systems") */
  suffix: string;
  address: string;
  contractSelector: string;
  entrypoints: ABIEntrypoint[];
  structs: Map<string, ABIParam[]>;
}

// ── Policy types ─────────────────────────────────────────────────────────────

export interface PolicyMethod {
  name: string;
  entrypoint: string;
  selector: string;
  description: string;
}

export interface GeneratedPolicies {
  contracts: Record<string, { methods: PolicyMethod[] }>;
  coverage: Map<string, string[]>;
}

// ── Manifest types ───────────────────────────────────────────────────────────

export interface ManifestContract {
  tag?: string;
  address?: string;
  selector?: string;
  abi?: unknown[];
}

export interface Manifest {
  contracts?: ManifestContract[];
}

// ── Domain overlay types ─────────────────────────────────────────────────────

export interface ParamOverride {
  /** Override the parameter description for the LLM */
  description?: string;
  /** Transform the param value before passing to Contract.populate() */
  transform?: (v: unknown) => unknown;
}

export interface DomainOverlay {
  /** Override action type name (e.g., ABI "send" → "send_resources") */
  actionType?: string;
  /** Rich description replacing the ABI signature */
  description?: string;
  /** Per-param overrides */
  paramOverrides?: Record<string, ParamOverride>;
  /** Pre-flight validation. Returns error string or null if OK. */
  preflight?: (params: Record<string, unknown>, cachedState?: unknown) => string | null;
  /** Additional action type aliases */
  aliases?: string[];
  /** Hide this entrypoint from the LLM */
  hidden?: boolean;
}

/** Keyed by "{contractSuffix}::{entrypoint}" */
export type DomainOverlayMap = Record<string, DomainOverlay>;

// ── Action execution types ───────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  txHash?: string;
  data?: unknown;
  error?: string;
}

export interface GameAction {
  type: string;
  params: Record<string, unknown>;
}

/** Maps action type → { contractTag, entrypoint, overlayKey } */
export interface ActionRoute {
  contractTag: string;
  contractAddress: string;
  entrypoint: string;
  overlayKey: string;
  overlay?: DomainOverlay;
}
