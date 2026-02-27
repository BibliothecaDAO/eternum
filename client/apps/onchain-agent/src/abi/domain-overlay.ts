/**
 * Eternum-specific domain overlays for the ABI-driven pipeline.
 *
 * Enriches raw ABI entrypoints with game-specific context:
 * - Human-readable action type names (e.g., ABI "send" → "send_resources")
 * - Rich descriptions for the LLM
 * - Parameter transforms (precision scaling, type coercion)
 * - Pre-flight validation checks
 * - Action aliases
 * - Hidden flags for admin/internal entrypoints
 */
import type { DomainOverlayMap, Manifest } from "./types";
import { extractAllFromManifest, getGameEntrypoints } from "./parser";

// ── Constants ────────────────────────────────────────────────────────────────

/** On-chain amounts (troops, resources) must be multiplied by this factor. */
export const RESOURCE_PRECISION = 1_000_000_000;

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

const RESOURCE_TYPE_NAMES: Record<number, string> = {
  1: "Stone",
  2: "Coal",
  3: "Wood",
  4: "Copper",
  5: "Ironwood",
  6: "Obsidian",
  7: "Gold",
  8: "Silver",
  9: "Mithral",
  10: "Alchemical Silver",
  11: "Cold Iron",
  12: "Deep Crystal",
  13: "Ruby",
  14: "Diamonds",
  15: "Hartwood",
  16: "Ignium",
  17: "Twilight Quartz",
  18: "True Ice",
  19: "Adamantine",
  20: "Sapphire",
  21: "Ethereal Silica",
  22: "Dragonhide",
  23: "Labor",
  24: "Ancient Fragment",
  25: "Donkey",
  26: "Knight",
  27: "Knight T2",
  28: "Knight T3",
  29: "Crossbowman",
  30: "Crossbowman T2",
  31: "Crossbowman T3",
  32: "Paladin",
  33: "Paladin T2",
  34: "Paladin T3",
  35: "Wheat",
  36: "Fish",
  37: "Lords",
  38: "Essence",
};

// ── Param transform helpers ──────────────────────────────────────────────────

/**
 * Coerce an LLM value to a number. Handles K/M/B/T suffixes and commas.
 */
export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number(v);
  const s = v.replace(/,/g, "").trim().toUpperCase();
  const suffixes: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  const match = s.match(/^(-?[\d.]+)\s*([KMBT])$/);
  if (match) return parseFloat(match[1]) * suffixes[match[2]];
  return Number(s);
}

/** Coerce to number and multiply by RESOURCE_PRECISION for on-chain amounts. */
export function precisionAmount(v: unknown): number {
  return Math.floor(num(v) * RESOURCE_PRECISION);
}

export function bool(v: unknown): boolean {
  if (typeof v === "string") return v === "true" || v === "1";
  return Boolean(v);
}

export function numArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(num);
  return [];
}

/**
 * Transform LLM resource array [{resourceType, amount}, ...] into
 * ABI-compatible Span<(u8, u128)> tuples: [[type, precisionAmount], ...]
 */
export function resourceTuples(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  return v.map((r: any) => [
    num(r.resourceType ?? r.resource_type ?? r.resourceId ?? r.resource_id ?? 0),
    precisionAmount(r.amount ?? 0),
  ]);
}

/**
 * Transform LLM steal-resource array [{resourceId, amount}, ...] into
 * ABI-compatible Span<(u8, u128)> tuples: [[type, precisionAmount], ...]
 */
export function stealResourceTuples(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  return v.map((r: any) => [
    num(r.resourceId ?? r.resource_id ?? r.resourceType ?? r.resource_type ?? 0),
    precisionAmount(r.amount ?? 0),
  ]);
}

/**
 * Transform LLM contribution array into ABI-compatible Span<(u8, u128)> tuples.
 * Accepts either [{resourceType, amount}] objects or a flat [type, amount, ...] array.
 */
export function contributionTuples(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  // Flat array: [type, amount, type, amount, ...]
  if (v.length > 0 && typeof v[0] === "number") {
    const tuples: [number, number][] = [];
    for (let i = 0; i + 1 < v.length; i += 2) {
      tuples.push([num(v[i]), precisionAmount(v[i + 1])]);
    }
    return tuples;
  }
  // Object array: [{resourceType, amount}, ...]
  return resourceTuples(v);
}

// ── Contract suffixes to hide from the LLM ───────────────────────────────────

/** Contract suffixes that should not be exposed to the LLM (admin/config/dev). */
export const HIDDEN_SUFFIXES = ["config_systems", "dev_resource_systems", "season_systems", "realm_internal_systems"];

/**
 * Generate hidden overlays for all entrypoints in the given contract suffixes.
 * Requires the manifest to enumerate entrypoints dynamically.
 */
export function createHiddenOverlays(manifest: Manifest, suffixes: string[] = HIDDEN_SUFFIXES): DomainOverlayMap {
  const overlays: DomainOverlayMap = {};
  const contracts = extractAllFromManifest(manifest);
  for (const contract of contracts) {
    if (!suffixes.includes(contract.suffix)) continue;
    for (const ep of getGameEntrypoints(contract)) {
      overlays[`${contract.suffix}::${ep.name}`] = { hidden: true };
    }
  }
  return overlays;
}

// ── Pre-flight helpers ───────────────────────────────────────────────────────

/**
 * Pre-flight: check sender has sufficient resource balance.
 * Fail-open: returns null (passes) if cached state is unavailable.
 */
function preflightSendResources(params: Record<string, unknown>, cachedState?: unknown): string | null {
  const state = cachedState as any;
  if (!state?.entities) return null;
  const senderId = num(params.sender_structure_id);
  const sender = state.entities.find((e: any) => e.entityId === senderId && e.type === "structure");
  if (!sender?.resources) return null;
  const resources = resourceTuples(params.resources);
  for (const [resourceType, rawAmount] of resources) {
    const name = RESOURCE_TYPE_NAMES[resourceType] ?? `Resource#${resourceType}`;
    const have = sender.resources.get(name) ?? 0;
    const need = rawAmount / RESOURCE_PRECISION;
    if (need > have) {
      return `Insufficient balance: have ${have} ${name}, need ${need}`;
    }
  }
  return null;
}

/**
 * Pre-flight: check army limit at structure before creating explorer.
 */
function preflightCreateExplorer(params: Record<string, unknown>, cachedState?: unknown): string | null {
  const state = cachedState as any;
  if (!state?.entities) return null;
  const structureId = num(params.for_structure_id);
  const structure = state.entities.find((e: any) => e.entityId === structureId && e.type === "structure" && e.isOwned);
  if (structure?.armies && structure.armies.max > 0 && structure.armies.current >= structure.armies.max) {
    return `Structure has ${structure.armies.current}/${structure.armies.max} armies. Upgrade realm level or delete an army first.`;
  }
  return null;
}

/**
 * Pre-flight: check explorer stamina when exploring (not just traveling).
 */
function preflightExplorerMove(params: Record<string, unknown>, cachedState?: unknown): string | null {
  if (!bool(params.explore)) return null;
  const state = cachedState as any;
  if (!state?.entities) return null;
  const explorerId = num(params.explorer_id);
  const explorer = state.entities.find((e: any) => e.entityId === explorerId && e.type === "army" && e.isOwned);
  const dirs = numArray(params.directions);
  const staminaNeeded = 30 * Math.max(dirs.length, 1);
  if (explorer?.stamina !== undefined && explorer.stamina < staminaNeeded) {
    return `Explorer has ${explorer.stamina} stamina, need ${staminaNeeded} to explore. Use explore=false for traveled tiles (10 stamina/hex). Wait for regen (+20/min).`;
  }
  return null;
}

// ── Eternum overlay map ──────────────────────────────────────────────────────

export const ETERNUM_OVERLAYS: DomainOverlayMap = {
  // ── Resources ──────────────────────────────────────────────────────────────

  "resource_systems::send": {
    actionType: "send_resources",
    description: "Send resources from one structure to another",
    paramOverrides: {
      sender_structure_id: { description: "Structure ID of the sender" },
      recipient_structure_id: { description: "Structure ID of the recipient" },
      resources: {
        description: `Array of {resourceType, amount} to send. ${RESOURCE_IDS}`,
        transform: resourceTuples,
      },
    },
    preflight: preflightSendResources,
  },

  "resource_systems::pickup": {
    actionType: "pickup_resources",
    description: "Pick up resources from a structure you own",
    paramOverrides: {
      recipient_structure_id: { description: "Structure ID receiving the resources" },
      owner_structure_id: { description: "Structure ID that owns the resources" },
      resources: {
        description: `Array of {resourceType, amount} to pick up. ${RESOURCE_IDS}`,
        transform: resourceTuples,
      },
    },
  },

  "resource_systems::arrivals_offload": {
    actionType: "claim_arrivals",
    description:
      "Claim incoming resource arrivals at a structure. Use inspect_realm to see incomingArrivals — each arrival has a day, slot, and resource list.",
    paramOverrides: {
      from_structure_id: { description: "Structure entity ID to claim at" },
      day: { description: "Day index of the arrival (from inspect_realm incomingArrivals)" },
      slot: { description: "Slot index of the arrival (from inspect_realm incomingArrivals)" },
      resource_count: { description: "Number of distinct resource types in the arrival" },
    },
  },

  "resource_systems::approve": {
    description: "Approve another structure to transfer resources on your behalf",
    paramOverrides: {
      caller_structure_id: { description: "Your structure ID granting approval" },
      recipient_structure_id: { description: "Structure ID being approved" },
      resources: {
        description: `Array of [resourceType, amount] tuples to approve. ${RESOURCE_IDS}`,
        transform: resourceTuples,
      },
    },
  },

  "resource_systems::troop_troop_adjacent_transfer": {
    description: "Transfer resources between two adjacent explorers",
    paramOverrides: {
      from_explorer_id: { description: "Source explorer entity ID" },
      to_explorer_id: { description: "Destination explorer entity ID" },
      resources: {
        description: `Array of {resourceType, amount} to transfer. ${RESOURCE_IDS}`,
        transform: resourceTuples,
      },
    },
  },

  "resource_systems::troop_structure_adjacent_transfer": {
    description: "Transfer resources from an explorer to an adjacent structure",
    paramOverrides: {
      from_explorer_id: { description: "Source explorer entity ID" },
      to_structure_id: { description: "Destination structure entity ID" },
      resources: {
        description: `Array of {resourceType, amount} to transfer. ${RESOURCE_IDS}`,
        transform: resourceTuples,
      },
    },
  },

  "resource_systems::structure_troop_adjacent_transfer": {
    description: "Transfer resources from a structure to an adjacent explorer",
    paramOverrides: {
      from_structure_id: { description: "Source structure entity ID" },
      to_troop_id: { description: "Destination explorer entity ID" },
      resources: {
        description: `Array of {resourceType, amount} to transfer. ${RESOURCE_IDS}`,
        transform: resourceTuples,
      },
    },
  },

  "resource_systems::troop_burn": {
    description: "Burn (destroy) resources carried by an explorer",
    paramOverrides: {
      explorer_id: { description: "Explorer entity ID" },
      resources: {
        description: `Array of {resourceType, amount} to burn. ${RESOURCE_IDS}`,
        transform: resourceTuples,
      },
    },
  },

  "resource_systems::structure_burn": {
    description: "Burn (destroy) resources at a structure",
    paramOverrides: {
      structure_id: { description: "Structure entity ID" },
      resources: {
        description: `Array of {resourceType, amount} to burn. ${RESOURCE_IDS}`,
        transform: resourceTuples,
      },
    },
  },

  "resource_systems::structure_regularize_weight": {
    hidden: true,
  },

  // ── Troop Management ───────────────────────────────────────────────────────

  "troop_management_systems::explorer_create": {
    actionType: "create_explorer",
    description: "Create a new explorer troop from a structure",
    paramOverrides: {
      for_structure_id: { description: "Structure entity ID to spawn from" },
      category: { description: `Troop category (${TROOP_CATEGORY})` },
      tier: { description: `Troop tier (${TROOP_TIER}; higher is stronger)` },
      amount: {
        description: "Number of troops to create",
        transform: precisionAmount,
      },
      spawn_direction: { description: `Hex direction to spawn (${DIR})` },
    },
    preflight: preflightCreateExplorer,
  },

  "troop_management_systems::explorer_add": {
    actionType: "add_to_explorer",
    description: "Add more troops to an existing explorer (explorer must be adjacent to its home structure)",
    paramOverrides: {
      to_explorer_id: { description: "Explorer entity ID to reinforce" },
      amount: {
        description: "Number of troops to add",
        transform: precisionAmount,
      },
      home_direction: {
        description: `Direction FROM the explorer TO its home structure (${DIR}). Check explorer's neighbor tiles to find which direction the structure is in.`,
      },
    },
  },

  "troop_management_systems::explorer_delete": {
    actionType: "delete_explorer",
    description: "Delete an explorer and return troops to structure",
    paramOverrides: {
      explorer_id: { description: "Explorer entity ID to delete" },
    },
  },

  "troop_management_systems::guard_add": {
    actionType: "add_guard",
    description: "Add a guard troop to a structure's defense slot",
    paramOverrides: {
      for_structure_id: { description: "Structure entity ID to guard" },
      slot: { description: "Guard slot index (0-3, depends on structure max guards)" },
      category: { description: `Troop category (${TROOP_CATEGORY})` },
      tier: { description: `Troop tier (${TROOP_TIER})` },
      amount: {
        description: "Number of troops",
        transform: precisionAmount,
      },
    },
  },

  "troop_management_systems::guard_delete": {
    actionType: "delete_guard",
    description: "Remove a guard from a structure's defense slot",
    paramOverrides: {
      for_structure_id: { description: "Structure entity ID" },
      slot: { description: "Guard slot index to clear (0-3)" },
    },
  },

  "troop_management_systems::explorer_explorer_swap": {
    actionType: "swap_explorer_to_explorer",
    description: "Transfer troops between two explorers (must be on adjacent hexes)",
    paramOverrides: {
      from_explorer_id: { description: "Source explorer entity ID" },
      to_explorer_id: { description: "Destination explorer entity ID" },
      to_explorer_direction: { description: `Hex direction from source to destination (${DIR})` },
      count: {
        description: "Number of troops to transfer",
        transform: precisionAmount,
      },
    },
  },

  "troop_management_systems::explorer_guard_swap": {
    actionType: "swap_explorer_to_guard",
    description:
      "Transfer troops from an explorer to a structure guard slot (explorer must be adjacent to the structure)",
    paramOverrides: {
      from_explorer_id: { description: "Source explorer entity ID" },
      to_structure_id: { description: "Destination structure entity ID" },
      to_structure_direction: { description: `Hex direction from explorer to structure (${DIR})` },
      to_guard_slot: { description: "Guard slot index at the structure (0-3)" },
      count: {
        description: "Number of troops to transfer",
        transform: precisionAmount,
      },
    },
  },

  "troop_management_systems::guard_explorer_swap": {
    actionType: "swap_guard_to_explorer",
    description:
      "Transfer troops from a structure guard slot to an explorer (explorer must be adjacent to the structure)",
    paramOverrides: {
      from_structure_id: { description: "Source structure entity ID" },
      from_guard_slot: { description: "Guard slot index at the structure (0-3)" },
      to_explorer_id: { description: "Destination explorer entity ID" },
      to_explorer_direction: { description: `Hex direction from structure to explorer (${DIR})` },
      count: {
        description: "Number of troops to transfer",
        transform: precisionAmount,
      },
    },
  },

  // ── Troop Movement ─────────────────────────────────────────────────────────

  "troop_movement_systems::explorer_move": {
    actionType: "move_explorer",
    description:
      "Move an explorer along hex directions. With explore=false: multi-hex travel through explored tiles (~10 stamina/hex). " +
      "With explore=true: single-hex exploration of an unrevealed tile (30 stamina, min 10 troops, awards VP).",
    aliases: ["travel_explorer", "explore"],
    paramOverrides: {
      explorer_id: { description: "Explorer entity ID" },
      directions: { description: `Array of hex directions (${DIR})` },
      explore: {
        description:
          "false = travel through already-explored tiles (cheap). true = explore new tile (expensive, awards VP)",
      },
    },
    preflight: preflightExplorerMove,
  },

  // ── Combat ─────────────────────────────────────────────────────────────────

  "troop_battle_systems::attack_explorer_vs_explorer": {
    actionType: "attack_explorer",
    description: "Attack another explorer with your explorer (costs 50 stamina attacker, 40 defender)",
    paramOverrides: {
      aggressor_id: { description: "Your explorer entity ID" },
      defender_id: { description: "Target explorer entity ID" },
      defender_direction: { description: `Hex direction from attacker to defender (${DIR})` },
      steal_resources: {
        description: `Array of {resourceId, amount} to steal on victory. ${RESOURCE_IDS}`,
        transform: stealResourceTuples,
      },
    },
  },

  "troop_battle_systems::attack_explorer_vs_guard": {
    actionType: "attack_guard",
    description: "Attack a structure's guard with your explorer",
    paramOverrides: {
      explorer_id: { description: "Your explorer entity ID" },
      structure_id: { description: "Target structure entity ID" },
      structure_direction: { description: `Hex direction from explorer to structure (${DIR})` },
    },
  },

  "troop_battle_systems::attack_guard_vs_explorer": {
    actionType: "guard_attack_explorer",
    description: "Use a structure's guard to attack a nearby explorer",
    paramOverrides: {
      structure_id: { description: "Your structure entity ID" },
      structure_guard_slot: { description: "Guard slot index (0-3)" },
      explorer_id: { description: "Target explorer entity ID" },
      explorer_direction: { description: `Hex direction from structure to explorer (${DIR})` },
    },
  },

  // ── Raid ────────────────────────────────────────────────────────────────────

  "troop_raid_systems::raid_explorer_vs_guard": {
    actionType: "raid",
    description: "Raid a structure to steal resources (without destroying guard)",
    paramOverrides: {
      explorer_id: { description: "Your explorer entity ID" },
      structure_id: { description: "Target structure entity ID" },
      structure_direction: { description: `Hex direction from explorer to structure (${DIR})` },
      steal_resources: {
        description: `Array of {resourceId, amount} to steal. ${RESOURCE_IDS}`,
        transform: stealResourceTuples,
      },
    },
  },

  // ── Trade ──────────────────────────────────────────────────────────────────

  "trade_systems::create_order": {
    description: "Create a trade order on the market",
    aliases: ["create_trade"],
    paramOverrides: {
      maker_id: { description: "Your structure entity ID offering resources" },
      taker_id: { description: "Target structure entity ID (0 for open market)" },
      maker_gives_resource_type: { description: `Resource type ID you are offering. ${RESOURCE_IDS}` },
      taker_pays_resource_type: { description: `Resource type ID you want in return. ${RESOURCE_IDS}` },
      maker_gives_min_resource_amount: {
        description: "Minimum amount per trade unit",
        transform: precisionAmount,
      },
      maker_gives_max_count: { description: "Maximum number of trade units" },
      taker_pays_min_resource_amount: {
        description: "Minimum payment per trade unit",
        transform: precisionAmount,
      },
      expires_at: { description: "Expiration timestamp" },
    },
  },

  "trade_systems::accept_order": {
    description: "Accept an existing trade order",
    aliases: ["accept_trade"],
    paramOverrides: {
      taker_id: { description: "Your structure entity ID accepting the trade" },
      trade_id: { description: "Trade order ID to accept" },
      taker_buys_count: { description: "Number of trade units to buy" },
    },
  },

  "trade_systems::cancel_order": {
    description: "Cancel your trade order",
    aliases: ["cancel_trade"],
    paramOverrides: {
      trade_id: { description: "Trade order ID to cancel" },
    },
  },

  // ── Buildings / Production ─────────────────────────────────────────────────

  "production_systems::create_building": {
    description:
      `Build a new building at a structure. Each building produces a resource per tick but consumes inputs (mainly Wheat + Labor). ` +
      `Buildings are placed on an inner hex grid centered at (10,10). The 'directions' array is a PATH from center outward — it must have at least 1 element. ` +
      `Ring 1 (6 slots): [0],[1],[2],[3],[4],[5]. ` +
      `Ring 2 (12 slots): [0,0],[0,1],[1,1],[1,2],[2,2],[2,3],[3,3],[3,4],[4,4],[4,5],[5,5],[5,0]. ` +
      `Ring 3 (18 slots): [0,0,0],[0,0,1],[0,1,1],[1,1,1],[1,1,2],[1,2,2],[2,2,2],[2,2,3],[2,3,3],[3,3,3],[3,3,4],[3,4,4],[4,4,4],[4,4,5],[4,5,5],[5,5,5],[5,5,0],[5,0,0]. ` +
      `Available rings depend on structure level: L0=ring1 (6), L1=rings1-2 (18), L2=rings1-3 (36). ` +
      `IMPORTANT: Use a path from "Free building paths" shown in your world state — these are confirmed unoccupied slots. Do NOT guess paths. ${BUILDING_GUIDE}`,
    paramOverrides: {
      structure_id: { description: "Structure entity ID to build at" },
      directions: {
        description: `Path from center hex to building slot — MUST have at least 1 direction. Direction IDs: ${DIR}. Use paths listed above per ring.`,
      },
      building_category: { description: `Building category ID. ${BUILDING_TYPES}` },
      use_simple: {
        description:
          "true = pay only Labor (higher amount, no other resources). false = pay Labor + specific resources. T2/T3 military buildings are NOT available in simple mode",
      },
    },
  },

  "production_systems::destroy_building": {
    description: "Destroy a building at a structure",
    paramOverrides: {
      structure_id: { description: "Structure entity ID" },
      building_coord: { description: "Building coordinate — pass as {x: number, y: number}" },
    },
  },

  "production_systems::pause_building_production": {
    actionType: "pause_production",
    description: "Pause production at a building",
    paramOverrides: {
      structure_id: { description: "Structure entity ID" },
      building_coord: { description: "Building coordinate — pass as {x: number, y: number}" },
    },
  },

  "production_systems::resume_building_production": {
    actionType: "resume_production",
    description: "Resume production at a paused building",
    paramOverrides: {
      structure_id: { description: "Structure entity ID" },
      building_coord: { description: "Building coordinate — pass as {x: number, y: number}" },
    },
  },

  // ── Bank / Swap ────────────────────────────────────────────────────────────

  "swap_systems::buy": {
    actionType: "buy_resources",
    description: "Buy resources from the bank using Lords",
    paramOverrides: {
      bank_entity_id: { description: "Bank entity ID" },
      structure_id: { description: "Your structure entity ID making the purchase" },
      resource_type: { description: `Resource type ID to buy. ${RESOURCE_IDS}` },
      amount: {
        description: "Amount to buy",
        transform: precisionAmount,
      },
    },
  },

  "swap_systems::sell": {
    actionType: "sell_resources",
    description: "Sell resources to the bank for Lords",
    paramOverrides: {
      bank_entity_id: { description: "Bank entity ID" },
      structure_id: { description: "Your structure entity ID selling" },
      resource_type: { description: `Resource type ID to sell. ${RESOURCE_IDS}` },
      amount: {
        description: "Amount to sell",
        transform: precisionAmount,
      },
    },
  },

  // ── Liquidity ──────────────────────────────────────────────────────────────

  "liquidity_systems::add": {
    actionType: "add_liquidity",
    description: "Add liquidity to the bank's AMM pool",
    paramOverrides: {
      bank_entity_id: { description: "Bank entity ID" },
      entity_id: { description: "Your entity ID providing liquidity" },
      resource_type: { description: `Resource type ID. ${RESOURCE_IDS}` },
      resource_amount: {
        description: "Amount of the resource to provide",
        transform: precisionAmount,
      },
      lords_amount: {
        description: "Amount of Lords to provide",
        transform: precisionAmount,
      },
    },
  },

  "liquidity_systems::remove": {
    actionType: "remove_liquidity",
    description: "Remove liquidity from the bank's AMM pool",
    paramOverrides: {
      bank_entity_id: { description: "Bank entity ID" },
      entity_id: { description: "Your entity ID" },
      resource_type: { description: `Resource type ID. ${RESOURCE_IDS}` },
      shares: { description: "Number of LP shares to remove" },
    },
  },

  // ── Guild ──────────────────────────────────────────────────────────────────

  "guild_systems::create_guild": {
    description: "Create a new guild",
    paramOverrides: {
      public: { description: "Whether the guild is open to anyone" },
      name: { description: "Name for the guild" },
    },
  },

  "guild_systems::join_guild": {
    description: "Join an existing guild",
    paramOverrides: {
      guild_id: { description: "Guild entity ID to join" },
    },
  },

  "guild_systems::leave_guild": {
    description: "Leave your current guild",
  },

  "guild_systems::update_whitelist": {
    description: "Add or remove an address from guild whitelist",
    paramOverrides: {
      address: { description: "Player hex address to whitelist/unwhitelist" },
      whitelist: { description: "true to add, false to remove" },
    },
  },

  "guild_systems::remove_member": {
    description: "Remove a member from the guild (guild leader only)",
    paramOverrides: {
      address: { description: "Player hex address to remove" },
    },
  },

  // ── Structure / Realm ──────────────────────────────────────────────────────

  "structure_systems::level_up": {
    actionType: "upgrade_realm",
    description:
      "Upgrade your realm to the next level. Each level unlocks more building slots: L0=6, L1=18, L2=36. " +
      "Cost shown in world state under 'Next upgrade'. Requires Labor, Wheat, Essence, and higher-tier resources at higher levels.",
    paramOverrides: {
      structure_id: { description: "Realm entity ID to upgrade" },
    },
  },

  // ── Hyperstructure ─────────────────────────────────────────────────────────

  "hyperstructure_systems::contribute": {
    actionType: "contribute_hyperstructure",
    description:
      "Contribute resources to a hyperstructure. In Blitz, hyperstructures are pre-built — capture them from bandits via attack_guard first.",
    paramOverrides: {
      hyperstructure_id: { description: "Hyperstructure entity ID" },
      from_structure_id: { description: "Your structure entity ID contributing" },
      contribution: {
        description: `Array of {resourceType, amount} or flat [type, amount, ...] pairs. ${RESOURCE_IDS}`,
        transform: contributionTuples,
      },
    },
  },

  "hyperstructure_systems::initialize": {
    description: "Initialize a hyperstructure (usually done once after capture)",
    paramOverrides: {
      hyperstructure_id: { description: "Hyperstructure entity ID" },
    },
  },

  "hyperstructure_systems::allocate_shares": {
    description: "Allocate hyperstructure point shares to contributors",
    paramOverrides: {
      hyperstructure_id: { description: "Hyperstructure entity ID" },
      shareholders: {
        description: "Array of [address, share_amount] tuples for share allocation",
      },
    },
  },

  "hyperstructure_systems::claim_share_points": {
    description: "Claim accumulated share points from hyperstructures",
    paramOverrides: {
      hyperstructure_ids: { description: "Array of hyperstructure entity IDs to claim from" },
    },
  },

  // ── Blitz Game Setup ───────────────────────────────────────────────────────

  "blitz_realm_systems::obtain_entry_token": {
    description: "Obtain an entry token to register for a Blitz game",
  },

  "blitz_realm_systems::register": {
    description: "Register for a Blitz game using your entry token",
    paramOverrides: {
      name: { description: "Player name (felt252)" },
      entry_token_id: { description: "Entry token ID obtained from obtain_entry_token" },
      cosmetic_token_ids: { description: "Array of cosmetic token IDs" },
    },
  },

  "blitz_realm_systems::make_hyperstructures": {
    description: "Create hyperstructures for the Blitz game (admin/setup action)",
    paramOverrides: {
      count: { description: "Number of hyperstructures to create" },
    },
  },

  "blitz_realm_systems::create": {
    hidden: true, // Dojo framework entrypoint — use settle_blitz_realm composite instead
    description: "Dojo create entrypoint (deprecated — use settle_blitz_realm instead)",
  },

  // ── Name ───────────────────────────────────────────────────────────────────

  "name_systems::set_address_name": {
    description: "Set your player display name",
    paramOverrides: {
      name: { description: "Display name (felt252 encoded)" },
    },
  },

  // ── Relic ──────────────────────────────────────────────────────────────────

  "relic_systems::open_chest": {
    description: "Open a relic chest at a coordinate with an explorer",
    paramOverrides: {
      explorer_id: { description: "Explorer entity ID" },
      chest_coord: { description: "Chest coordinate — pass as {x: number, y: number}" },
    },
  },

  "relic_systems::apply_relic": {
    description: "Apply a relic effect to an entity",
    paramOverrides: {
      entity_id: { description: "Entity ID to apply the relic to" },
      relic_resource_id: { description: "Relic resource type ID" },
      recipient_type: { description: "Type of recipient for the relic effect" },
    },
  },

  // ── Production extras ──────────────────────────────────────────────────────

  "production_systems::burn_resource_for_labor_production": {
    description: "Burn resources to produce Labor at a structure",
    paramOverrides: {
      structure_id: { description: "Structure entity ID" },
      resource_types: { description: `Array of resource type IDs to burn. ${RESOURCE_IDS}` },
      resource_amounts: {
        description: "Array of amounts to burn (matching resource_types order)",
      },
    },
  },

  "production_systems::burn_labor_for_resource_production": {
    description: "Burn Labor to produce resources at a structure",
    paramOverrides: {
      from_structure_id: { description: "Structure entity ID" },
      production_cycles: { description: "Array of production cycle counts" },
      produced_resource_types: { description: `Array of resource type IDs to produce. ${RESOURCE_IDS}` },
    },
  },

  "production_systems::burn_resource_for_resource_production": {
    description: "Burn one resource to produce another resource at a structure",
    paramOverrides: {
      from_structure_id: { description: "Structure entity ID" },
      produced_resource_types: { description: `Array of resource type IDs to produce. ${RESOURCE_IDS}` },
      production_cycles: { description: "Array of production cycle counts" },
    },
  },

  "production_systems::claim_wonder_production_bonus": {
    description: "Claim production bonus from a wonder structure",
    paramOverrides: {
      structure_id: { description: "Your structure entity ID" },
      wonder_structure_id: { description: "Wonder structure entity ID to claim bonus from" },
    },
  },

  // ── Bank ────────────────────────────────────────────────────────────────────

  "bank_systems::create_banks": {
    hidden: true,
  },

  // ── Ownership ──────────────────────────────────────────────────────────────

  "ownership_systems::transfer_structure_ownership": {
    description: "Transfer ownership of a structure to another address",
    paramOverrides: {
      structure_id: { description: "Structure entity ID to transfer" },
      new_owner: { description: "New owner address" },
    },
  },

  "ownership_systems::transfer_agent_ownership": {
    description: "Transfer agent ownership to another address",
  },

  // ── Prize Distribution ─────────────────────────────────────────────────────

  "prize_distribution_systems::blitz_prize_claim": {
    description: "Claim your prize from a completed Blitz game",
  },

  "prize_distribution_systems::blitz_prize_player_rank": {
    description: "Check your rank in a Blitz game for prize distribution",
  },

  "prize_distribution_systems::blitz_prize_claim_no_game": {
    hidden: true,
  },

  // ── Realm ──────────────────────────────────────────────────────────────────

  "realm_systems::create": {
    hidden: true,
  },

  // ── Village ────────────────────────────────────────────────────────────────

  "village_systems::create": {
    actionType: "create_village",
    description: "Create a new village",
  },
};
