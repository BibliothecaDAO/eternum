import type { EternumClient } from "@bibliothecadao/client";
import type { ActionResult, GameAction } from "@bibliothecadao/game-agent";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// Re-declared here to avoid tsup d.ts resolution issues with game-agent.
// These types mirror the canonical definitions in @bibliothecadao/game-agent/types.
interface ActionParamSchema {
  name: string;
  type: "number" | "string" | "boolean" | "number[]" | "object[]" | "bigint";
  description: string;
  required?: boolean;
}

export interface ActionDefinition {
  type: string;
  description: string;
  params: ActionParamSchema[];
}
import type { Account } from "starknet";

export type ActionHandler = (
  client: EternumClient,
  signer: Account,
  params: Record<string, unknown>,
) => Promise<ActionResult>;

// ---------------------------------------------------------------------------
// Registry internals
// ---------------------------------------------------------------------------

interface RegistryEntry {
  handler: ActionHandler;
  definition: ActionDefinition;
}

const registry = new Map<string, RegistryEntry>();
let _currentActionType: string | undefined;

function register(type: string, description: string, params: ActionParamSchema[], handler: ActionHandler) {
  registry.set(type, { handler, definition: { type, description, params } });
}

function registerAliases(types: string[], description: string, params: ActionParamSchema[], handler: ActionHandler) {
  // All aliases share a single definition (using the first type as canonical)
  const definition: ActionDefinition = { type: types[0], description, params };
  for (const type of types) {
    registry.set(type, { handler, definition });
  }
}

// ---------------------------------------------------------------------------
// Param schema helpers
// ---------------------------------------------------------------------------

const n = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "number",
  description,
  required,
});

const s = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "string",
  description,
  required,
});

const b = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "boolean",
  description,
  required,
});

const na = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "number[]",
  description,
  required,
});

const oa = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "object[]",
  description,
  required,
});

/**
 * Extract a short, human-readable error from a Starknet error.
 * Starknet errors often contain huge execution traces; we pull out the useful bit.
 */
/**
 * Try to decode felt252 hex values into readable ASCII strings.
 * Returns decoded strings of length >= 3 chars.
 */
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
      let s = "";
      for (let i = 0; i < h.length; i += 2) {
        const code = parseInt(h.slice(i, i + 2), 16);
        if (code >= 32 && code < 127) s += String.fromCharCode(code);
      }
      if (s.length >= 3) decoded.push(s);
    } catch {}
  }
  return [...new Set(decoded)];
}

function extractErrorMessage(err: any): string {
  // Collect all text sources: message, baseError (RpcError), data, revert_reason
  const sources: string[] = [];
  const msg = err?.message ?? String(err);
  sources.push(msg);

  // starknet.js RpcError wraps the real error in baseError
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
  if (err?.revert_reason) sources.push(String(err.revert_reason));
  if (err?.revertReason) sources.push(String(err.revertReason));

  const raw = sources.join("\n");

  // Look for "Transaction failed with reason:" from our provider
  const txFailedMatch = raw.match(/Transaction failed with reason:\s*(.+?)(?:\n|$)/i);
  if (txFailedMatch) return txFailedMatch[1].trim();

  // Look for "Failure reason:" pattern common in Starknet reverts.
  // The failure block looks like: Failure reason:\n(hex ('label'), ..., \"actual error message\", hex ('ENTRYPOINT_FAILED'))
  // Extract the quoted plain-text error first, then fall back to decoded felt labels.
  const failureBlock = raw.match(/Failure reason:\s*\\?n?\(?(.+?)\)?\s*(?:\.\s*)?(?:\\n|$)/is);
  if (failureBlock) {
    // Look for escaped-quoted plain-text message: \"some error\" or \\\"some error\\\"
    const quotedMsg = failureBlock[1].match(/\\*"([a-zA-Z][^"\\]*(?:\s[^"\\]*)*)\\*"/);
    if (quotedMsg) return quotedMsg[1].trim();
    // Look for single-quoted decoded felt labels like ('argent/multicall-failed')
    // Skip generic wrappers, keep domain-specific error labels
    const labels = [...failureBlock[1].matchAll(/\('([^']+)'\)/g)]
      .map((m) => m[1])
      .filter((l) => l !== "ENTRYPOINT_FAILED" && l !== "" && l !== "argent/multicall-failed");
    if (labels.length > 0) return labels.join(", ");
  }

  // Look for "execution_revert" or "revert_error" in structured data
  const revertDataMatch = raw.match(/(?:execution_revert|revert_error|revert_reason)["\s:]+([^"}\]]+)/i);
  if (revertDataMatch) return `Reverted: ${revertDataMatch[1].trim()}`;

  // Look for "execution reverted" with a reason
  const revertMatch = raw.match(/execution reverted[:\s]*(.+?)(?:\n|$)/i);
  if (revertMatch) return `Reverted: ${revertMatch[1].trim()}`;

  // Look for Cairo panic/assert messages
  const cairoMatch = raw.match(/(?:assert|panic)[:\s]+(.+?)(?:\n|$)/i);
  if (cairoMatch) return cairoMatch[1].trim();

  // Look for felt252 short-string error codes in all sources
  const decoded = decodeFeltHexStrings(raw);
  if (decoded.length > 0) {
    return `Reverted: ${decoded.join(", ")}`;
  }

  // Truncate generic long errors to something readable
  const firstLine = msg.split("\n")[0].trim();
  if (firstLine.length > 200) return firstLine.slice(0, 200) + "...";
  return firstLine;
}

/** Log raw error to debug file for post-mortem analysis. */
function logRawError(actionType: string, err: any) {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug-actions-raw-errors.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();

    // Dump everything we can from the error object
    const parts: string[] = [`[${ts}] ${actionType}`];
    parts.push(`  message: ${err?.message}`);
    parts.push(`  name: ${err?.name}`);
    parts.push(`  code: ${err?.code}`);
    // starknet.js RpcError stores the original RPC error in baseError
    if (err?.baseError) {
      parts.push(`  baseError.code: ${err.baseError.code}`);
      parts.push(`  baseError.message: ${err.baseError.message}`);
      try {
        parts.push(`  baseError.data: ${JSON.stringify(err.baseError.data)?.slice(0, 4000)}`);
      } catch {
        parts.push(`  baseError.data: ${String(err.baseError.data)?.slice(0, 4000)}`);
      }
    }
    if (err?.data) {
      try {
        parts.push(`  data: ${JSON.stringify(err.data)?.slice(0, 4000)}`);
      } catch {
        parts.push(`  data: ${String(err.data)?.slice(0, 4000)}`);
      }
    }
    if (err?.cause) {
      parts.push(`  cause: ${err.cause?.message ?? String(err.cause)}`);
    }
    if (err?.request) {
      try {
        parts.push(`  request.method: ${err.request.method}`);
      } catch {}
    }
    // Enumerate all own keys for anything we missed
    try {
      const keys = Object.getOwnPropertyNames(err).filter(
        (k) => !["message", "name", "stack", "code", "baseError", "data", "cause", "request"].includes(k),
      );
      for (const k of keys) {
        try {
          const v = err[k];
          parts.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v)?.slice(0, 1000) : String(v)}`);
        } catch {}
      }
    } catch {}
    parts.push(`  stack: ${err?.stack?.slice(0, 1000)}`);
    parts.push("");

    writeFileSync(debugPath, parts.join("\n") + "\n", { flag: "a" });
  } catch (_) {}
}

/**
 * Wrap an async client transaction call into a normalised ActionResult.
 * Handles both `transaction_hash` and `transactionHash` return shapes.
 * Strips raw chain data from success responses and extracts readable errors.
 */
async function wrapTx(fn: () => Promise<any>): Promise<ActionResult> {
  try {
    const result = await fn();
    const txHash = result?.transaction_hash ?? result?.transactionHash ?? undefined;
    return {
      success: true,
      txHash,
      // Only include minimal confirmation data, not the full chain response
      data: txHash ? { transactionHash: txHash } : undefined,
    };
  } catch (err: any) {
    logRawError(_currentActionType ?? "unknown", err);
    return {
      success: false,
      error: extractErrorMessage(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers – coerce unknown params from the LLM into typed values
// ---------------------------------------------------------------------------

/** On-chain amounts (troops, resources) must be multiplied by this precision factor. */
const RESOURCE_PRECISION = 1_000_000_000;

/**
 * Coerce an LLM value to a number. Handles human-readable suffixes
 * (K, M, B, T) and commas so the agent can pass values like "1.5K" or "2,000".
 */
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number(v);
  const s = v.replace(/,/g, "").trim().toUpperCase();
  const suffixes: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  const match = s.match(/^(-?[\d.]+)\s*([KMBT])$/);
  if (match) return parseFloat(match[1]) * suffixes[match[2]];
  return Number(v);
}

/** Coerce to number and multiply by RESOURCE_PRECISION for on-chain amounts. */
function precisionAmount(v: unknown): number {
  return Math.floor(num(v) * RESOURCE_PRECISION);
}

function str(v: unknown): string {
  return String(v);
}

function bool(v: unknown): boolean {
  if (typeof v === "string") return v === "true" || v === "1";
  return Boolean(v);
}

function bigNumberish(v: unknown): string | bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid numeric value '${v}'`);
    }
    return BigInt(Math.trunc(v));
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) {
      throw new Error("Address cannot be empty");
    }
    return trimmed;
  }
  throw new Error(`Unsupported BigNumberish value type '${typeof v}'`);
}

function numArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(num);
  return [];
}

function resourceList(v: unknown): { resourceType: number; amount: number }[] {
  if (!Array.isArray(v)) return [];
  return v.map((r: any) => ({
    resourceType: num(r.resourceType ?? r.resource_type ?? r.resourceId ?? 0),
    amount: precisionAmount(r.amount ?? 0),
  }));
}

function stealResourceList(v: unknown): { resourceId: number; amount: number }[] {
  if (!Array.isArray(v)) return [];
  return v.map((r: any) => ({
    resourceId: num(r.resourceId ?? r.resource_id ?? r.resourceType ?? 0),
    amount: precisionAmount(r.amount ?? 0),
  }));
}

function buildingCoord(v: unknown): { alt?: boolean; x: number; y: number } {
  const c = v as any;
  return {
    alt: c?.alt != null ? bool(c.alt) : undefined,
    x: num(c?.x ?? 0),
    y: num(c?.y ?? 0),
  };
}

function liquidityCalls(v: unknown): { resourceType: number; resourceAmount: number; lordsAmount: number }[] {
  if (!Array.isArray(v)) return [];
  return v.map((c: any) => ({
    resourceType: num(c.resourceType ?? c.resource_type ?? 0),
    resourceAmount: precisionAmount(c.resourceAmount ?? c.resource_amount ?? 0),
    lordsAmount: precisionAmount(c.lordsAmount ?? c.lords_amount ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Shared reference strings for enum-valued params
// ---------------------------------------------------------------------------

const RESOURCE_IDS =
  "Resource IDs: 1=Stone, 2=Coal, 3=Wood, 4=Copper, 5=Ironwood, 6=Obsidian, 7=Gold, 8=Silver, " +
  "9=Mithral, 10=AlchemicalSilver, 11=ColdIron, 12=DeepCrystal, 13=Ruby, 14=Diamonds, " +
  "15=Hartwood, 16=Ignium, 17=TwilightQuartz, 18=TrueIce, 19=Adamantine, 20=Sapphire, " +
  "21=EtherealSilica, 22=Dragonhide, 23=Labor, 24=AncientFragment, 25=Donkey, " +
  "26=Knight, 27=KnightT2, 28=KnightT3, 29=Crossbowman, 30=CrossbowmanT2, 31=CrossbowmanT3, " +
  "32=Paladin, 33=PaladinT2, 34=PaladinT3, 35=Wheat, 36=Fish, 37=Lords, 38=Essence";

const BUILDING_TYPES =
  "Building IDs: 0=None, 1=WorkersHut, 2=Storehouse, 3=Stone, 4=Coal, 5=Wood, 6=Copper, " +
  "7=Ironwood, 8=Obsidian, 9=Gold, 10=Silver, 11=Mithral, 12=AlchemicalSilver, 13=ColdIron, " +
  "14=DeepCrystal, 15=Ruby, 16=Diamonds, 17=Hartwood, 18=Ignium, 19=TwilightQuartz, " +
  "20=TrueIce, 21=Adamantine, 22=Sapphire, 23=EtherealSilica, 24=Dragonhide, 25=Labor, " +
  "26=AncientFragment, 27=Donkey, 28=KnightT1, 29=KnightT2, 30=KnightT3, " +
  "31=CrossbowmanT1, 32=CrossbowmanT2, 33=CrossbowmanT3, 34=PaladinT1, 35=PaladinT2, " +
  "36=PaladinT3, 37=Wheat, 38=Fish, 39=Essence";

// Compact building reference: ID, simple-mode Labor cost, pop cost, production inputs/outputs.
// Format: "ID:Name — cost:L<labor> pop:<pop> produces:<resource>(output/tick) consumes:<inputs>"
// Buildings with empty [] costs cannot be built in simple mode.
// Realm must produce the resource matching the building (e.g., Realm must have Stone to build Stone building).
const BUILDING_GUIDE =
  "BUILDING GUIDE — build cost (simple=Labor only | complex=Labor+resources), per-tick production consumption:\n" +
  "Economy:\n" +
  "  1:WorkersHut — simple:60L | complex:20L+20Wood | pop:0, +6 population\n" +
  "  27:Donkey — simple:180L | complex:60L+60Wood | pop:3, 1/tick. simple: free | complex: 3Wheat\n" +
  "  25:Labor — free to build | pop:1, 1/tick, free upkeep\n" +
  "  37:Wheat(Farm) — simple:10L | complex:10L | pop:1, 6/tick, free upkeep\n" +
  "  38:Fish — free | pop:1, realm-native, free upkeep\n" +
  "Base Resources (1/tick, pop:2):\n" +
  "  5:Wood — simple:30L | complex:30L. simple: 1Wh+0.5Lab | complex: 1Wh+0.2Coal+0.2Copper\n" +
  "  4:Coal — simple:90L | complex:30L+30Wood. simple: 1Wh+1Lab | complex: 1Wh+0.3Wood+0.2Copper\n" +
  "  6:Copper — simple:300L | complex:60L+60Wood+30Coal. simple: 1Wh+1Lab | complex: 1Wh+0.3Wood+0.2Coal\n" +
  "  3:Stone — realm-native, free build, free upkeep\n" +
  "Mid Resources (1/tick, pop:2):\n" +
  "  7:Ironwood — simple:720L | complex:120L+120Wood+60Coal+30Copper. simple: 2Wh+2.5Lab | complex: 2Wh+0.6Coal+0.4Copper\n" +
  "  13:ColdIron — simple:720L | complex:120L+120Wood+60Coal+30Copper. simple: 2Wh+2.5Lab | complex: 2Wh+0.6Coal+0.4Copper\n" +
  "  9:Gold — simple:720L | complex:120L+120Wood+60Coal+30Copper. simple: 2Wh+2.5Lab | complex: 2Wh+0.6Coal+0.4Copper\n" +
  "Rare Resources (1/tick, pop:2):\n" +
  "  21:Adamantine — simple:free | complex:240L+180Wood+120Copper+60Ironwood+600Essence. simple: 4Wh+10Lab | complex: 3Wh+0.9Coal+0.6Ironwood\n" +
  "  11:Mithral — simple:free | complex:240L+180Wood+120Copper+60ColdIron+600Essence. simple: 4Wh+10Lab | complex: 3Wh+0.9Coal+0.6ColdIron\n" +
  "  24:Dragonhide — simple:free | complex:240L+180Wood+120Copper+60Gold+600Essence. simple: 4Wh+10Lab | complex: 3Wh+0.9Coal+0.6Gold\n" +
  "T1 Military (5 troops/tick, pop:3):\n" +
  "  28:KnightT1 — simple:1200L | complex:180L+180Wood+120Copper. simple: 2Wh+0.5Lab | complex: 2Wh+0.4Copper\n" +
  "  31:CrossbowT1 — simple:1200L | complex:180L+180Wood+120Copper. simple: 2Wh+0.5Lab | complex: 2Wh+0.4Copper\n" +
  "  34:PaladinT1 — simple:1200L | complex:180L+180Wood+120Copper. simple: 2Wh+0.5Lab | complex: 2Wh+0.4Copper\n" +
  "T2 Military (5 troops/tick, pop:3) — complex mode ONLY:\n" +
  "  29:KnightT2 — complex:360L+240Wood+180Copper+60ColdIron+600Essence. consumes: 3Wh+10KnightT1+0.2Copper+0.6ColdIron+1Essence\n" +
  "  32:CrossbowT2 — complex:360L+240Wood+180Copper+60Ironwood+600Essence. consumes: 3Wh+10CrossbowT1+0.2Copper+0.6Ironwood+1Essence\n" +
  "  35:PaladinT2 — complex:360L+240Wood+180Copper+60Gold+600Essence. consumes: 3Wh+10PaladinT1+0.2Copper+0.6Gold+1Essence\n" +
  "T3 Military (5 troops/tick, pop:3) — complex mode ONLY:\n" +
  "  30:KnightT3 — complex:540L+360Wood+240ColdIron+120Mithral+1200Essence. consumes: 4Wh+10KnightT2+0.4ColdIron+0.8Mithral+3Essence\n" +
  "  33:CrossbowT3 — complex:540L+360Wood+240Ironwood+120Adamantine+1200Essence. consumes: 4Wh+10CrossbowT2+0.4Ironwood+0.8Adamantine+3Essence\n" +
  "  36:PaladinT3 — complex:540L+360Wood+240Gold+120Dragonhide+1200Essence. consumes: 4Wh+10PaladinT2+0.4Gold+0.8Dragonhide+3Essence\n" +
  "Slots: Level 0=6, Level 1=18, Level 2=36. Formula: 3*(level+1)*(level+2). Use directions to path from center hex.\n" +
  "Priority: Wheat farms first (all production needs Wheat), then Labor, then resource buildings, then military.";

const DIR = "0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE";

const TROOP_CATEGORY = "0=Knight, 1=Paladin, 2=Crossbowman";

const TROOP_TIER = "0=T1, 1=T2, 2=T3";

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

register(
  "send_resources",
  "Send resources from one entity to another",
  [
    n("senderEntityId", "Entity ID of the sender"),
    n("recipientEntityId", "Entity ID of the recipient"),
    oa("resources", `Array of {resourceType, amount} to send. ${RESOURCE_IDS}`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.resources.send(signer, {
        senderEntityId: num(p.senderEntityId),
        recipientEntityId: num(p.recipientEntityId),
        resources: resourceList(p.resources),
      }),
    ),
);

register(
  "pickup_resources",
  "Pick up resources from an entity you own",
  [
    n("recipientEntityId", "Entity ID receiving the resources"),
    n("ownerEntityId", "Entity ID that owns the resources"),
    oa("resources", `Array of {resourceType, amount} to pick up. ${RESOURCE_IDS}`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.resources.pickup(signer, {
        recipientEntityId: num(p.recipientEntityId),
        ownerEntityId: num(p.ownerEntityId),
        resources: resourceList(p.resources),
      }),
    ),
);

register(
  "claim_arrivals",
  "Claim incoming resource arrivals at a structure",
  [
    n("structureId", "Structure entity ID to claim at"),
    n("day", "Day index"),
    n("slot", "Slot index"),
    n("resourceCount", "Number of resources to claim"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.resources.claimArrivals(signer, {
        structureId: num(p.structureId),
        day: num(p.day),
        slot: num(p.slot),
        resourceCount: num(p.resourceCount),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Troops
// ---------------------------------------------------------------------------

register(
  "create_explorer",
  "Create a new explorer troop from a structure",
  [
    n("forStructureId", "Structure entity ID to spawn from"),
    n("category", `Troop category (${TROOP_CATEGORY})`),
    n("tier", `Troop tier (${TROOP_TIER}; higher is stronger)`),
    n("amount", "Number of troops to create"),
    n("spawnDirection", `Hex direction (${DIR})`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.createExplorer(signer, {
        forStructureId: num(p.forStructureId),
        category: num(p.category),
        tier: num(p.tier),
        amount: precisionAmount(p.amount),
        spawnDirection: num(p.spawnDirection),
      }),
    ),
);

register(
  "add_to_explorer",
  "Add more troops to an existing explorer",
  [
    n("toExplorerId", "Explorer entity ID to reinforce"),
    n("amount", "Number of troops to add"),
    n("homeDirection", `Direction back to home structure (${DIR})`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.addToExplorer(signer, {
        toExplorerId: num(p.toExplorerId),
        amount: precisionAmount(p.amount),
        homeDirection: num(p.homeDirection),
      }),
    ),
);

register(
  "delete_explorer",
  "Delete an explorer and return troops to structure",
  [n("explorerId", "Explorer entity ID to delete")],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.deleteExplorer(signer, {
        explorerId: num(p.explorerId),
      }),
    ),
);

register(
  "add_guard",
  "Add a guard troop to a structure's defense slot",
  [
    n("forStructureId", "Structure entity ID to guard"),
    n("slot", "Guard slot index (0-3, depends on structure max guards)"),
    n("category", `Troop category (${TROOP_CATEGORY})`),
    n("tier", `Troop tier (${TROOP_TIER})`),
    n("amount", "Number of troops"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.addGuard(signer, {
        forStructureId: num(p.forStructureId),
        slot: num(p.slot),
        category: num(p.category),
        tier: num(p.tier),
        amount: precisionAmount(p.amount),
      }),
    ),
);

register(
  "delete_guard",
  "Remove a guard from a structure's defense slot",
  [n("forStructureId", "Structure entity ID"), n("slot", "Guard slot index to clear (0-3)")],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.deleteGuard(signer, {
        forStructureId: num(p.forStructureId),
        slot: num(p.slot),
      }),
    ),
);

register(
  "move_explorer",
  "Move an explorer along hex directions (optionally exploring)",
  [
    n("explorerId", "Explorer entity ID"),
    na("directions", `Array of hex directions (${DIR})`),
    b("explore", "Whether to explore (discover new tiles) while moving"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.move(signer, {
        explorerId: num(p.explorerId),
        directions: numArray(p.directions),
        explore: bool(p.explore),
      }),
    ),
);

register(
  "travel_explorer",
  "Travel an explorer along hex directions (no exploration)",
  [n("explorerId", "Explorer entity ID"), na("directions", `Array of hex directions (${DIR})`)],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.travel(signer, {
        explorerId: num(p.explorerId),
        directions: numArray(p.directions),
      }),
    ),
);

register(
  "explore",
  "Explore new tiles with an explorer",
  [n("explorerId", "Explorer entity ID"), na("directions", `Array of hex directions (${DIR})`)],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.explore(signer, {
        explorerId: num(p.explorerId),
        directions: numArray(p.directions),
      }),
    ),
);

register(
  "swap_explorer_to_explorer",
  "Transfer troops between two explorers",
  [
    n("fromExplorerId", "Source explorer entity ID"),
    n("toExplorerId", "Destination explorer entity ID"),
    n("toExplorerDirection", `Hex direction (${DIR})`),
    n("count", "Number of troops to transfer"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.swapExplorerToExplorer(signer, {
        fromExplorerId: num(p.fromExplorerId),
        toExplorerId: num(p.toExplorerId),
        toExplorerDirection: num(p.toExplorerDirection),
        count: precisionAmount(p.count),
      }),
    ),
);

register(
  "swap_explorer_to_guard",
  "Transfer troops from an explorer to a structure guard slot",
  [
    n("fromExplorerId", "Source explorer entity ID"),
    n("toStructureId", "Destination structure entity ID"),
    n("toStructureDirection", `Hex direction (${DIR})`),
    n("toGuardSlot", "Guard slot index at the structure (0-3)"),
    n("count", "Number of troops to transfer"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.swapExplorerToGuard(signer, {
        fromExplorerId: num(p.fromExplorerId),
        toStructureId: num(p.toStructureId),
        toStructureDirection: num(p.toStructureDirection),
        toGuardSlot: num(p.toGuardSlot),
        count: precisionAmount(p.count),
      }),
    ),
);

register(
  "swap_guard_to_explorer",
  "Transfer troops from a structure guard slot to an explorer",
  [
    n("fromStructureId", "Source structure entity ID"),
    n("fromGuardSlot", "Guard slot index at the structure (0-3)"),
    n("toExplorerId", "Destination explorer entity ID"),
    n("toExplorerDirection", `Hex direction (${DIR})`),
    n("count", "Number of troops to transfer"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.swapGuardToExplorer(signer, {
        fromStructureId: num(p.fromStructureId),
        fromGuardSlot: num(p.fromGuardSlot),
        toExplorerId: num(p.toExplorerId),
        toExplorerDirection: num(p.toExplorerDirection),
        count: precisionAmount(p.count),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

register(
  "attack_explorer",
  "Attack another explorer with your explorer (costs 50 stamina attacker, 40 defender)",
  [
    n("aggressorId", "Your explorer entity ID"),
    n("defenderId", "Target explorer entity ID"),
    n("defenderDirection", `Hex direction (${DIR})`),
    oa("stealResources", `Array of {resourceId, amount} to steal on victory. ${RESOURCE_IDS}`, false),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.combat.attackExplorer(signer, {
        aggressorId: num(p.aggressorId),
        defenderId: num(p.defenderId),
        defenderDirection: num(p.defenderDirection),
        stealResources: stealResourceList(p.stealResources),
      }),
    ),
);

register(
  "attack_guard",
  "Attack a structure's guard with your explorer",
  [
    n("explorerId", "Your explorer entity ID"),
    n("structureId", "Target structure entity ID"),
    n("structureDirection", `Hex direction (${DIR})`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.combat.attackGuard(signer, {
        explorerId: num(p.explorerId),
        structureId: num(p.structureId),
        structureDirection: num(p.structureDirection),
      }),
    ),
);

register(
  "guard_attack_explorer",
  "Use a structure's guard to attack a nearby explorer",
  [
    n("structureId", "Your structure entity ID"),
    n("structureGuardSlot", "Guard slot index (0-3, depends on structure max guards)"),
    n("explorerId", "Target explorer entity ID"),
    n("explorerDirection", `Hex direction (${DIR})`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.combat.guardAttackExplorer(signer, {
        structureId: num(p.structureId),
        structureGuardSlot: num(p.structureGuardSlot),
        explorerId: num(p.explorerId),
        explorerDirection: num(p.explorerDirection),
      }),
    ),
);

register(
  "raid",
  "Raid a structure to steal resources (without destroying guard)",
  [
    n("explorerId", "Your explorer entity ID"),
    n("structureId", "Target structure entity ID"),
    n("structureDirection", `Hex direction (${DIR})`),
    oa("stealResources", `Array of {resourceId, amount} to steal. ${RESOURCE_IDS}`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.combat.raid(signer, {
        explorerId: num(p.explorerId),
        structureId: num(p.structureId),
        structureDirection: num(p.structureDirection),
        stealResources: stealResourceList(p.stealResources),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------

const createOrderParams: ActionParamSchema[] = [
  n("makerId", "Your structure entity ID offering resources"),
  n("takerId", "Target structure entity ID (0 for open market)"),
  n("makerGivesResourceType", `Resource type ID you are offering. ${RESOURCE_IDS}`),
  n("takerPaysResourceType", `Resource type ID you want in return. ${RESOURCE_IDS}`),
  n("makerGivesMinResourceAmount", "Minimum amount per trade unit"),
  n("makerGivesMaxCount", "Maximum number of trade units"),
  n("takerPaysMinResourceAmount", "Minimum payment per trade unit"),
  n("expiresAt", "Expiration timestamp"),
];

const createOrderHandler: ActionHandler = (client, signer, p) =>
  wrapTx(() =>
    client.trade.createOrder(signer, {
      makerId: num(p.makerId),
      takerId: num(p.takerId),
      makerGivesResourceType: num(p.makerGivesResourceType),
      takerPaysResourceType: num(p.takerPaysResourceType),
      makerGivesMinResourceAmount: precisionAmount(p.makerGivesMinResourceAmount),
      makerGivesMaxCount: num(p.makerGivesMaxCount),
      takerPaysMinResourceAmount: precisionAmount(p.takerPaysMinResourceAmount),
      expiresAt: num(p.expiresAt),
    }),
  );

const acceptOrderParams: ActionParamSchema[] = [
  n("takerId", "Your structure entity ID accepting the trade"),
  n("tradeId", "Trade order ID to accept"),
  n("takerBuysCount", "Number of trade units to buy"),
];

const acceptOrderHandler: ActionHandler = (client, signer, p) =>
  wrapTx(() =>
    client.trade.acceptOrder(signer, {
      takerId: num(p.takerId),
      tradeId: num(p.tradeId),
      takerBuysCount: num(p.takerBuysCount),
    }),
  );

const cancelOrderParams: ActionParamSchema[] = [n("tradeId", "Trade order ID to cancel")];

const cancelOrderHandler: ActionHandler = (client, signer, p) =>
  wrapTx(() =>
    client.trade.cancelOrder(signer, {
      tradeId: num(p.tradeId),
    }),
  );

registerAliases(
  ["create_order", "create_trade"],
  "Create a trade order on the market",
  createOrderParams,
  createOrderHandler,
);
registerAliases(
  ["accept_order", "accept_trade"],
  "Accept an existing trade order",
  acceptOrderParams,
  acceptOrderHandler,
);
registerAliases(["cancel_order", "cancel_trade"], "Cancel your trade order", cancelOrderParams, cancelOrderHandler);

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

register(
  "create_building",
  `Build a new building at a structure. Each building produces a resource per tick but consumes inputs (mainly Wheat + Labor). ` +
    `Buildings are placed on an inner hex grid centered at (10,10). The 'directions' array is a PATH from center outward — it must have at least 1 element. ` +
    `Ring 1 (6 slots): [0],[1],[2],[3],[4],[5]. ` +
    `Ring 2 (12 slots): [0,0],[0,1],[1,1],[1,2],[2,2],[2,3],[3,3],[3,4],[4,4],[4,5],[5,5],[5,0]. ` +
    `Ring 3 (18 slots): [0,0,0],[0,0,1],[0,1,1],[1,1,1],[1,1,2],[1,2,2],[2,2,2],[2,2,3],[2,3,3],[3,3,3],[3,3,4],[3,4,4],[4,4,4],[4,4,5],[4,5,5],[5,5,5],[5,5,0],[5,0,0]. ` +
    `Available rings depend on structure level: L0=ring1 (6), L1=rings1-2 (18), L2=rings1-3 (36). ` +
    `IMPORTANT: Use a path from "Free building paths" shown in your world state — these are confirmed unoccupied slots. Do NOT guess paths. ${BUILDING_GUIDE}`,
  [
    n("entityId", "Structure entity ID to build at"),
    na(
      "directions",
      `Path from center hex to building slot — MUST have at least 1 direction. Direction IDs: ${DIR}. Use paths listed above per ring.`,
    ),
    n("buildingCategory", `Building category ID. ${BUILDING_TYPES}`),
    b(
      "useSimple",
      "true = pay only Labor (higher amount, no other resources). false = pay Labor + specific resources. T2/T3 military buildings are NOT available in simple mode",
    ),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.buildings.create(signer, {
        entityId: num(p.entityId),
        directions: numArray(p.directions),
        buildingCategory: num(p.buildingCategory),
        useSimple: bool(p.useSimple),
      }),
    ),
);

register(
  "destroy_building",
  "Destroy a building at a structure",
  [
    n("entityId", "Structure entity ID"),
    { name: "buildingCoord", type: "object[]" as any, description: "Building coordinate {x, y, alt?}" },
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.buildings.destroy(signer, {
        entityId: num(p.entityId),
        buildingCoord: buildingCoord(p.buildingCoord),
      }),
    ),
);

register(
  "pause_production",
  "Pause production at a building",
  [
    n("entityId", "Structure entity ID"),
    { name: "buildingCoord", type: "object[]" as any, description: "Building coordinate {x, y, alt?}" },
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.buildings.pauseProduction(signer, {
        entityId: num(p.entityId),
        buildingCoord: buildingCoord(p.buildingCoord),
      }),
    ),
);

register(
  "resume_production",
  "Resume production at a paused building",
  [
    n("entityId", "Structure entity ID"),
    { name: "buildingCoord", type: "object[]" as any, description: "Building coordinate {x, y, alt?}" },
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.buildings.resumeProduction(signer, {
        entityId: num(p.entityId),
        buildingCoord: buildingCoord(p.buildingCoord),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Bank
// ---------------------------------------------------------------------------

register(
  "buy_resources",
  "Buy resources from the bank using Lords",
  [
    n("bankEntityId", "Bank entity ID"),
    n("entityId", "Your entity ID making the purchase"),
    n("resourceType", `Resource type ID to buy. ${RESOURCE_IDS}`),
    n("amount", "Amount to buy"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.bank.buy(signer, {
        bankEntityId: num(p.bankEntityId),
        entityId: num(p.entityId),
        resourceType: num(p.resourceType),
        amount: precisionAmount(p.amount),
      }),
    ),
);

register(
  "sell_resources",
  "Sell resources to the bank for Lords",
  [
    n("bankEntityId", "Bank entity ID"),
    n("entityId", "Your entity ID selling"),
    n("resourceType", `Resource type ID to sell. ${RESOURCE_IDS}`),
    n("amount", "Amount to sell"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.bank.sell(signer, {
        bankEntityId: num(p.bankEntityId),
        entityId: num(p.entityId),
        resourceType: num(p.resourceType),
        amount: precisionAmount(p.amount),
      }),
    ),
);

register(
  "add_liquidity",
  "Add liquidity to the bank's AMM pool",
  [
    n("bankEntityId", "Bank entity ID"),
    n("entityId", "Your entity ID providing liquidity"),
    oa("calls", `Array of {resourceType, resourceAmount, lordsAmount}. ${RESOURCE_IDS}`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.bank.addLiquidity(signer, {
        bankEntityId: num(p.bankEntityId),
        entityId: num(p.entityId),
        calls: liquidityCalls(p.calls),
      }),
    ),
);

register(
  "remove_liquidity",
  "Remove liquidity from the bank's AMM pool",
  [
    n("bankEntityId", "Bank entity ID"),
    n("entityId", "Your entity ID"),
    n("resourceType", `Resource type ID. ${RESOURCE_IDS}`),
    n("shares", "Number of LP shares to remove"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.bank.removeLiquidity(signer, {
        bankEntityId: num(p.bankEntityId),
        entityId: num(p.entityId),
        resourceType: num(p.resourceType),
        shares: num(p.shares),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Guild
// ---------------------------------------------------------------------------

register(
  "create_guild",
  "Create a new guild",
  [b("isPublic", "Whether the guild is open to anyone"), s("guildName", "Name for the guild")],
  (client, signer, p) =>
    wrapTx(() =>
      client.guild.create(signer, {
        isPublic: bool(p.isPublic),
        guildName: str(p.guildName ?? p.name ?? ""),
      }),
    ),
);

register("join_guild", "Join an existing guild", [n("guildEntityId", "Guild entity ID to join")], (client, signer, p) =>
  wrapTx(() =>
    client.guild.join(signer, {
      guildEntityId: num(p.guildEntityId),
    }),
  ),
);

register("leave_guild", "Leave your current guild", [], (client, signer, _p) =>
  wrapTx(() => client.guild.leave(signer)),
);

register(
  "update_whitelist",
  "Add or remove an address from guild whitelist",
  [s("address", "Player hex address to whitelist/unwhitelist"), b("whitelist", "true to add, false to remove")],
  (client, signer, p) =>
    wrapTx(() =>
      client.guild.updateWhitelist(signer, {
        address: bigNumberish(p.address),
        whitelist: bool(p.whitelist),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Realm
// ---------------------------------------------------------------------------

register(
  "upgrade_realm",
  "Upgrade your realm to the next level",
  [n("realmEntityId", "Realm entity ID to upgrade")],
  (client, signer, p) =>
    wrapTx(() =>
      client.realm.upgrade(signer, {
        realmEntityId: num(p.realmEntityId),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Hyperstructure
// ---------------------------------------------------------------------------

register(
  "contribute_hyperstructure",
  "Contribute resources to a hyperstructure",
  [
    n("hyperstructureEntityId", "Hyperstructure entity ID"),
    n("contributorEntityId", "Your structure entity ID contributing"),
    na("contributions", "Array of contribution amounts by resource type"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.hyperstructure.contribute(signer, {
        hyperstructureEntityId: num(p.hyperstructureEntityId),
        contributorEntityId: num(p.contributorEntityId),
        contributions: numArray(p.contributions),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a registered action handler by its type string.
 */
export function getActionHandler(type: string): ActionHandler | undefined {
  return registry.get(type)?.handler;
}

/**
 * Return the list of all registered action type strings.
 */
export function getAvailableActions(): string[] {
  return Array.from(registry.keys());
}

/**
 * Return all action definitions (type + description + param schemas).
 * Used to build enriched tool descriptions for the LLM.
 */
export function getActionDefinitions(): ActionDefinition[] {
  // Deduplicate by definition reference (aliases share the same handler+def)
  const seen = new Set<ActionDefinition>();
  const defs: ActionDefinition[] = [];
  for (const entry of registry.values()) {
    if (!seen.has(entry.definition)) {
      seen.add(entry.definition);
      defs.push(entry.definition);
    }
  }
  return defs;
}

/**
 * Execute a GameAction by dispatching to the matching registered handler.
 * Returns a failed ActionResult if the action type is unknown.
 */
export async function executeAction(client: EternumClient, signer: Account, action: GameAction): Promise<ActionResult> {
  const entry = registry.get(action.type);
  if (!entry) {
    return { success: false, error: `Unknown action type: ${action.type}` };
  }

  // Set current action type so wrapTx can include it in raw error logs
  _currentActionType = action.type;
  const result = await entry.handler(client, signer, action.params);
  _currentActionType = undefined;

  // --- DEBUG: log every action execution ---
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug-actions.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    const paramStr = JSON.stringify(action.params);
    const status = result.success ? `OK tx=${result.txHash}` : `FAIL: ${result.error}`;
    writeFileSync(debugPath, `[${ts}] ${action.type}(${paramStr}) => ${status}\n`, { flag: "a" });
  } catch (_) {}

  return result;
}
