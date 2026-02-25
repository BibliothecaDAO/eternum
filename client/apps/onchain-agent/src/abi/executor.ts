/**
 * Generic ABI-driven action executor.
 *
 * Replaces hand-written action handlers by using Contract.populate() from
 * starknet.js to encode calldata directly from the manifest ABI. Overlay
 * param transforms are applied before encoding.
 */
import { Contract, CairoCustomEnum, type Account, type Call } from "starknet";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { ActionResult, ActionRoute, DomainOverlay, GameAction, Manifest } from "./types";
import { extractAllFromManifest } from "./parser";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ABIExecutor {
  /** Execute a game action by looking up the route and encoding via ABI. */
  execute: (action: GameAction) => Promise<ActionResult>;
}

export interface ABIExecutorOptions {
  /** Routing table from action-gen: action type → contract info. */
  routes: Map<string, ActionRoute>;
  /** Pre-flight hooks can return an error string to abort before tx. */
  cachedStateProvider?: () => unknown;
  /** Hook called before each tx for logging/debug. */
  onBeforeExecute?: (actionType: string, entrypoint: string, params: Record<string, unknown>) => void;
  /** Hook called after each tx for logging/debug. */
  onAfterExecute?: (actionType: string, result: ActionResult) => void;
}

// ── Contract cache ───────────────────────────────────────────────────────────

interface ContractCacheEntry {
  contract: Contract;
  abi: unknown[];
}

/** Global enum map built from ALL contract ABIs so cross-contract enums resolve. */
type EnumMap = Map<string, { variants: { name: string; type: string }[] }>;

function buildContractCache(manifest: Manifest): {
  cache: Map<string, ContractCacheEntry>;
  globalEnums: EnumMap;
} {
  const cache = new Map<string, ContractCacheEntry>();
  const globalEnums: EnumMap = new Map();
  const allContracts = extractAllFromManifest(manifest);

  for (const result of allContracts) {
    if (!result.address) continue;
    const rawContract = manifest.contracts?.find((c) => c.tag === result.tag);
    const abi = rawContract?.abi ?? [];
    if (abi.length === 0) continue;

    // Collect all enum definitions across every contract ABI
    for (const entry of abi as any[]) {
      if (entry.type === "enum" && entry.name !== "core::bool") {
        globalEnums.set(entry.name, entry);
      }
    }

    // starknet.js v8 uses object-based constructor for Dojo manifest ABIs
    const contract = new Contract({ abi: abi as any[], address: result.address });
    cache.set(result.address, { contract, abi });
  }

  return { cache, globalEnums };
}

// ── Error extraction (mirrors action-registry pattern) ───────────────────────

function decodeFeltHexStrings(text: string): string[] {
  const feltMatches = text.match(/0x[0-9a-fA-F]{6,}/g);
  if (!feltMatches) return [];
  const decoded: string[] = [];
  for (const hex of feltMatches) {
    try {
      const n = BigInt(hex);
      if (n === 0n) continue;
      let h = n.toString(16);
      if (h.length % 2 !== 0) h = "0" + h;
      // Skip values > 31 bytes — these are addresses/hashes, not short strings
      if (h.length > 62) continue;
      let s = "";
      const totalBytes = h.length / 2;
      for (let i = 0; i < h.length; i += 2) {
        const code = parseInt(h.slice(i, i + 2), 16);
        if (code >= 32 && code < 127) s += String.fromCharCode(code);
      }
      // Require ≥70% printable bytes AND at least 3 chars — filters random address fragments
      if (s.length >= 3 && s.length / totalBytes >= 0.7) decoded.push(s);
    } catch {}
  }
  return [...new Set(decoded)];
}

function extractErrorMessage(err: any): string {
  const sources: string[] = [];
  const msg = err?.message ?? String(err);
  sources.push(msg);

  if (err?.baseError) {
    if (err.baseError.message) sources.push(String(err.baseError.message));
    if (err.baseError.data) {
      const dataStr = typeof err.baseError.data === "string" ? err.baseError.data : JSON.stringify(err.baseError.data);
      sources.push(dataStr);
    }
  }
  if (err?.data) {
    const dataStr = typeof err.data === "string" ? err.data : JSON.stringify(err.data);
    sources.push(dataStr);
  }
  // Cartridge WASM errors store execution error detail in `_data`
  if (err?._data) {
    const dataStr = typeof err._data === "string" ? err._data : JSON.stringify(err._data);
    sources.push(dataStr);
  }
  if (err?.revert_reason) sources.push(String(err.revert_reason));
  if (err?.revertReason) sources.push(String(err.revertReason));

  const raw = sources.join("\n");

  const txFailedMatch = raw.match(/Transaction failed with reason:\s*(.+?)(?:\n|$)/i);
  if (txFailedMatch) return txFailedMatch[1].trim();

  const failureBlock = raw.match(/Failure reason:\s*\\?n?\(?(.+?)\)?\s*(?:\.\s*)?(?:\\n|$)/is);
  if (failureBlock) {
    const quotedMsg = failureBlock[1].match(/\\*"([a-zA-Z][^"\\]*(?:\s[^"\\]*)*)\\*"/);
    if (quotedMsg) return quotedMsg[1].trim();
    const labels = [...failureBlock[1].matchAll(/\('([^']+)'\)/g)]
      .map((m) => m[1])
      .filter((l) => l !== "ENTRYPOINT_FAILED" && l !== "" && l !== "argent/multicall-failed");
    if (labels.length > 0) return labels.join(", ");
  }

  // Cairo execution traces: "Error message: <msg>" — collect all and return the most specific one
  // Handle both real newlines and JSON-escaped \\n sequences
  const errorMessages = [...raw.matchAll(/Error message:\s*(.+?)(?:\\\\n|\\n|\n|$)/gi)]
    .map((m) => m[1].trim())
    .filter((m) => m.length > 0);
  if (errorMessages.length > 0) {
    // The last Error message is typically the most specific (innermost call)
    return errorMessages[errorMessages.length - 1];
  }

  const revertDataMatch = raw.match(/(?:execution_revert|revert_error|revert_reason)["\s:]+([^"}\]]+)/i);
  if (revertDataMatch) return `Reverted: ${revertDataMatch[1].trim()}`;

  const revertMatch = raw.match(/execution reverted[:\s]*(.+?)(?:\n|$)/i);
  if (revertMatch) return `Reverted: ${revertMatch[1].trim()}`;

  const cairoMatch = raw.match(/(?:assert|panic)[:\s]+(.+?)(?:\n|$)/i);
  if (cairoMatch) return cairoMatch[1].trim();

  const decoded = decodeFeltHexStrings(raw);
  if (decoded.length > 0) return `Reverted: ${decoded.join(", ")}`;

  const firstLine = msg.split("\n")[0].trim();
  if (firstLine.length > 200) return firstLine.slice(0, 200) + "...";
  return firstLine;
}

// ── Debug logging ───────────────────────────────────────────────────────────

function debugLogCoercion(
  actionType: string,
  entrypoint: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): void {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug",
      "coercion.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    const coerced: string[] = [];
    for (const [k, v] of Object.entries(after)) {
      if (v instanceof CairoCustomEnum) {
        coerced.push(`${k}=${(v as CairoCustomEnum).activeVariant()}`);
      }
    }
    const summary = coerced.length > 0 ? coerced.join(", ") : "(none)";
    const keyChanges = Object.keys(before).filter((k) => !(k in after));
    const renamed = keyChanges.length > 0 ? ` renamed=[${keyChanges.join(",")}]` : "";
    writeFileSync(debugPath, `[${ts}] ${actionType}(${entrypoint}) enums=[${summary}]${renamed}\n`, { flag: "a" });
  } catch (_) {}
}

function debugLogError(actionType: string, err: any): void {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug",
      "raw-errors.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    const obj: Record<string, unknown> = {};
    for (const p of Object.getOwnPropertyNames(err)) obj[p] = err[p];
    if (err?.baseError) obj.baseError = err.baseError;
    if (err?.data) obj._data = err.data;
    if (err?.cause) obj._cause = String(err.cause);
    writeFileSync(debugPath, `[${ts}] ${actionType}\n${JSON.stringify(obj, null, 2)}\n\n`, { flag: "a" });
  } catch (_) {}
}

// ── Executor factory ─────────────────────────────────────────────────────────

/**
 * Create an ABI-driven executor that resolves actions via manifest ABI.
 * Uses starknet.js Contract.populate() for ABI-aware calldata encoding
 * and account.execute() for transaction submission.
 */
export function createABIExecutor(
  manifest: Manifest,
  account: Account,
  options: ABIExecutorOptions,
): ABIExecutor {
  const { cache: contractCache, globalEnums } = buildContractCache(manifest);
  const globalStructs = buildGlobalStructMap(manifest);
  const { routes, cachedStateProvider, onBeforeExecute, onAfterExecute } = options;

  async function execute(action: GameAction): Promise<ActionResult> {
    const route = routes.get(action.type);
    if (!route) {
      return { success: false, error: `Unknown action type: ${action.type}` };
    }

    // Run pre-flight validation if overlay defines one
    if (route.overlay?.preflight) {
      const cachedState = cachedStateProvider?.();
      const preflightError = route.overlay.preflight(action.params, cachedState);
      if (preflightError) {
        return { success: false, error: preflightError };
      }
    }

    // Apply param transforms from overlay
    const transformedParams = applyParamTransforms(action.params, route.overlay);

    onBeforeExecute?.(action.type, route.entrypoint, transformedParams);

    // Look up the cached Contract instance
    const cached = contractCache.get(route.contractAddress);
    if (!cached) {
      return {
        success: false,
        error: `No contract found at address ${route.contractAddress} for action ${action.type}`,
      };
    }

    try {
      // Coerce plain numeric enum values to CairoCustomEnum instances
      const coercedParams = coerceEnumParams(transformedParams, route.entrypoint, cached.abi as unknown[], globalEnums);

      // Coerce struct params: ensure object shape with default fields
      const structCoerced = coerceStructParams(coercedParams, route.entrypoint, cached.abi as unknown[], globalStructs);

      // Debug: log coercion results so we can diagnose enum failures
      debugLogCoercion(action.type, route.entrypoint, transformedParams, structCoerced);

      // Use Contract.populate() for ABI-aware calldata encoding
      const call: Call = cached.contract.populate(route.entrypoint, structCoerced as any);
      const result = await account.execute(call);
      const txHash = result?.transaction_hash ?? (result as any)?.transactionHash ?? undefined;

      const actionResult: ActionResult = {
        success: true,
        txHash,
        data: txHash ? { transactionHash: txHash } : undefined,
      };

      onAfterExecute?.(action.type, actionResult);
      return actionResult;
    } catch (err: any) {
      debugLogError(action.type, err);
      const actionResult: ActionResult = {
        success: false,
        error: extractErrorMessage(err),
      };

      onAfterExecute?.(action.type, actionResult);
      return actionResult;
    }
  }

  return { execute };
}

// ── Enum coercion ────────────────────────────────────────────────────────────

/**
 * Convert plain numeric enum values to CairoCustomEnum instances and normalize
 * camelCase param keys to the snake_case names the ABI expects.
 *
 * Handles two issues:
 * 1. LLMs send camelCase keys (forStructureId) but ABIs use snake_case (for_structure_id)
 * 2. starknet.js v8 Contract.populate() expects CairoCustomEnum objects for enum
 *    parameters, but the LLM provides plain numbers (e.g., category: 0 for Knight)
 * 3. Span<EnumType> parameters need each array element coerced individually
 */
export function coerceEnumParams(
  params: Record<string, unknown>,
  entrypoint: string,
  abi: unknown[],
  globalEnums?: EnumMap,
): Record<string, unknown> {
  // Build enum map from contract ABI, then merge global enums as fallback
  // so cross-contract enum types (e.g., Direction defined in config_systems
  // but used in troop_movement_systems) are always resolved.
  const enums: EnumMap = new Map();
  if (globalEnums) {
    for (const [k, v] of globalEnums) enums.set(k, v);
  }
  for (const entry of abi as any[]) {
    if (entry.type === "enum" && entry.name !== "core::bool") {
      enums.set(entry.name, entry);
    }
  }

  // Find the entrypoint's inputs across all interfaces
  let inputs: { name: string; type: string }[] | undefined;
  for (const entry of abi as any[]) {
    if (entry.type === "interface" && Array.isArray(entry.items)) {
      const fn = entry.items.find(
        (item: any) => item.type === "function" && item.name === entrypoint,
      );
      if (fn) {
        inputs = fn.inputs;
        break;
      }
    }
  }
  if (!inputs) return params;

  // Normalize camelCase keys to snake_case ABI names
  const result = normalizeParamKeys(params, inputs);

  // Coerce enum values
  for (const input of inputs) {
    // Direct enum type
    let enumDef = enums.get(input.type);
    if (enumDef) {
      result[input.name] = coerceOneEnum(result[input.name], enumDef);
      continue;
    }

    // Span<EnumType> — extract inner type from "core::array::Span::<...>"
    const spanMatch = input.type.match(/^core::array::Span::<(.+)>$/);
    if (spanMatch) {
      enumDef = enums.get(spanMatch[1]);
      if (enumDef) {
        const spanValues = normalizeSpanValues(result[input.name]);
        if (spanValues) {
          result[input.name] = spanValues.map((v) => coerceOneEnum(v, enumDef!));
        }
      }
    }
  }

  return result;
}

/**
 * Normalize common LLM/tool-call variants of Span inputs into arrays.
 * Examples:
 * - 2                  -> [2]
 * - "{\"0\":1,\"1\":3}" -> [1, 3]
 * - {0: 1, 1: 3}       -> [1, 3]
 */
function normalizeSpanValues(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value;

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return [value];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      const fromParsed = normalizeSpanValues(parsed);
      if (fromParsed) return fromParsed;
    } catch {
      // Fall through to scalar handling
    }
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    }
    return [trimmed];
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const numericKeys = Object.keys(record)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    if (numericKeys.length > 0) {
      return numericKeys.map((k) => record[k]);
    }
  }

  return undefined;
}

/** Convert a single value to CairoCustomEnum if it's a plain number index. */
function coerceOneEnum(
  value: unknown,
  enumDef: { variants: { name: string; type: string }[] },
): unknown {
  if (value === undefined || value === null) return value;
  if (value instanceof CairoCustomEnum) return value;

  const index = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(index) || index < 0 || index >= enumDef.variants.length) return value;

  const variantObj: Record<string, any> = {};
  for (let i = 0; i < enumDef.variants.length; i++) {
    variantObj[enumDef.variants[i].name] = i === index ? {} : undefined;
  }
  return new CairoCustomEnum(variantObj);
}

/** Map camelCase param keys to the snake_case names the ABI expects. */
function normalizeParamKeys(
  params: Record<string, unknown>,
  inputs: { name: string; type: string }[],
): Record<string, unknown> {
  const abiNames = new Set(inputs.map((i) => i.name));
  const result: Record<string, unknown> = {};

  // Build a lookup: snake-normalized key → original param key
  const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

  for (const [key, value] of Object.entries(params)) {
    if (abiNames.has(key)) {
      // Key already matches ABI name
      result[key] = value;
    } else {
      // Try converting camelCase → snake_case
      const snake = camelToSnake(key);
      if (abiNames.has(snake)) {
        result[snake] = value;
      } else {
        // Keep as-is (unknown key)
        result[key] = value;
      }
    }
  }

  return result;
}

// ── Struct coercion ────────────────────────────────────────────────────────

type StructMap = Map<string, { name: string; type: string }[]>;

/** Build a global struct map from ALL contract ABIs. */
function buildGlobalStructMap(manifest: Manifest): StructMap {
  const structs: StructMap = new Map();
  for (const contract of manifest.contracts ?? []) {
    for (const entry of (contract.abi ?? []) as any[]) {
      if (entry.type === "struct" && entry.members) {
        structs.set(
          entry.name,
          entry.members.map((m: any) => ({ name: m.name, type: m.type as string })),
        );
      }
    }
  }
  return structs;
}

/** Default value for a Cairo type. */
function defaultForType(rawType: string): unknown {
  if (rawType === "core::bool") return false;
  if (rawType.startsWith("core::integer::")) return 0;
  if (rawType === "core::felt252") return "0";
  return 0;
}

/**
 * Coerce struct parameters: ensure the agent's object has all required fields
 * with sane defaults for any the agent omitted (e.g., `alt: false` on Coord).
 */
function coerceStructParams(
  params: Record<string, unknown>,
  entrypoint: string,
  abi: unknown[],
  structs: StructMap,
): Record<string, unknown> {
  // Find the entrypoint's inputs
  let inputs: { name: string; type: string }[] | undefined;
  for (const entry of abi as any[]) {
    if (entry.type === "interface" && Array.isArray(entry.items)) {
      const fn = entry.items.find(
        (item: any) => item.type === "function" && item.name === entrypoint,
      );
      if (fn) {
        inputs = fn.inputs;
        break;
      }
    }
  }
  if (!inputs) return params;

  const result = { ...params };
  for (const input of inputs) {
    const structDef = structs.get(input.type);
    if (!structDef) continue;

    let val = result[input.name];
    if (val === undefined || val === null) continue;

    // Unwrap single-element arrays — LLMs sometimes wrap structs in [{}]
    if (Array.isArray(val) && val.length === 1 && typeof val[0] === "object" && val[0] !== null) {
      val = val[0];
    }

    // If the agent passed a non-object (e.g. a number), skip — can't coerce
    if (typeof val !== "object" || Array.isArray(val)) continue;

    // Fill in missing fields with defaults
    const obj = { ...(val as Record<string, unknown>) };
    for (const field of structDef) {
      if (!(field.name in obj)) {
        obj[field.name] = defaultForType(field.type);
      }
    }
    result[input.name] = obj;
  }

  return result;
}

// ── Param transforms ─────────────────────────────────────────────────────────

function applyParamTransforms(
  params: Record<string, unknown>,
  overlay?: DomainOverlay,
): Record<string, unknown> {
  if (!overlay?.paramOverrides) return params;

  const result = { ...params };
  for (const [key, override] of Object.entries(overlay.paramOverrides)) {
    if (override.transform && key in result) {
      result[key] = override.transform(result[key]);
    }
  }
  return result;
}
