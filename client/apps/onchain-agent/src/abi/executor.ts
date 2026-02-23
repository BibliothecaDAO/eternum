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

function buildContractCache(manifest: Manifest): Map<string, ContractCacheEntry> {
  const cache = new Map<string, ContractCacheEntry>();
  const allContracts = extractAllFromManifest(manifest);

  for (const result of allContracts) {
    if (!result.address) continue;
    const rawContract = manifest.contracts?.find((c) => c.tag === result.tag);
    const abi = rawContract?.abi ?? [];
    if (abi.length === 0) continue;

    // starknet.js v8 uses object-based constructor for Dojo manifest ABIs
    const contract = new Contract({ abi: abi as any[], address: result.address });
    cache.set(result.address, { contract, abi });
  }

  return cache;
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

function debugLogError(actionType: string, err: any): void {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug-raw-errors.log",
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
  const contractCache = buildContractCache(manifest);
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
      const coercedParams = coerceEnumParams(transformedParams, route.entrypoint, cached.abi as unknown[]);

      // Use Contract.populate() for ABI-aware calldata encoding
      const call: Call = cached.contract.populate(route.entrypoint, coercedParams as any);
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
 * Convert plain numeric enum values to CairoCustomEnum instances.
 *
 * starknet.js v8 Contract.populate() expects CairoCustomEnum objects for enum
 * parameters, but the LLM provides plain numbers (e.g., category: 0 for Knight).
 * This function bridges the gap by looking up enum definitions in the ABI and
 * constructing the appropriate CairoCustomEnum for each enum-typed parameter.
 */
export function coerceEnumParams(
  params: Record<string, unknown>,
  entrypoint: string,
  abi: unknown[],
): Record<string, unknown> {
  // Build enum map: fully-qualified name → ABI enum entry
  const enums = new Map<string, { variants: { name: string; type: string }[] }>();
  for (const entry of abi as any[]) {
    if (entry.type === "enum" && entry.name !== "core::bool") {
      enums.set(entry.name, entry);
    }
  }
  if (enums.size === 0) return params;

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

  const result = { ...params };
  for (const input of inputs) {
    const enumDef = enums.get(input.type);
    if (!enumDef) continue;

    const value = result[input.name];
    if (value === undefined || value === null) continue;
    if (value instanceof CairoCustomEnum) continue;

    const index = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(index) || index < 0 || index >= enumDef.variants.length) continue;

    const variantObj: Record<string, any> = {};
    for (let i = 0; i < enumDef.variants.length; i++) {
      variantObj[enumDef.variants[i].name] = i === index ? {} : undefined;
    }
    result[input.name] = new CairoCustomEnum(variantObj);
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
