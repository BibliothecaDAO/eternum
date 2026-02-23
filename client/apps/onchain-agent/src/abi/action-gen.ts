/**
 * ABI → ActionDefinition[] generator.
 *
 * Transforms manifest ABI entrypoints into game-agent ActionDefinition objects
 * that the LLM uses to discover and call actions. Supports optional domain
 * overlays for game-specific enrichments (descriptions, param transforms, etc.).
 */
import { extractAllFromManifest, getGameEntrypoints, tagMatchesGame, abiTypeToParamSchemaType } from "./parser";
import type { ABIEntrypoint, ContractABIResult, DomainOverlayMap, Manifest, ActionRoute } from "./types";

// Re-declared to avoid import from game-agent (which may not be built).
interface ActionParamSchema {
  name: string;
  type: "number" | "string" | "boolean" | "number[]" | "object[]" | "bigint";
  description: string;
  required?: boolean;
}

interface ActionDefinition {
  type: string;
  description: string;
  params: ActionParamSchema[];
}

// ── Action generation ────────────────────────────────────────────────────────

export interface GeneratedActions {
  /** Action definitions for the LLM (passed to createGameAgent) */
  definitions: ActionDefinition[];
  /** Routing table: action type → contract info for execution */
  routes: Map<string, ActionRoute>;
}

/**
 * Generate ActionDefinition[] and a routing table from a manifest's ABI data.
 *
 * For each game-specific external entrypoint, creates:
 * - An ActionDefinition with typed params (for the LLM)
 * - An ActionRoute mapping action type → contract + entrypoint (for execution)
 *
 * Domain overlays can enrich descriptions, rename actions, add aliases, or hide entrypoints.
 */
export function generateActions(
  manifest: Manifest,
  options: {
    overlays?: DomainOverlayMap;
    gameName?: string;
  } = {},
): GeneratedActions {
  const { overlays = {}, gameName } = options;
  const definitions: ActionDefinition[] = [];
  const routes = new Map<string, ActionRoute>();

  const allContracts = extractAllFromManifest(manifest);
  // Track which overlay key first claimed each action type for collision detection
  const claimedBy = new Map<string, string>();

  for (const contract of allContracts) {
    if (!tagMatchesGame(contract.tag, gameName ?? null)) continue;
    if (!contract.address) continue;

    const gameEntrypoints = getGameEntrypoints(contract);

    for (const ep of gameEntrypoints) {
      const overlayKey = `${contract.suffix}::${ep.name}`;
      const overlay = overlays[overlayKey];

      // Skip hidden entrypoints
      if (overlay?.hidden) continue;

      // Determine action type name
      const actionType = overlay?.actionType ?? ep.name;

      // Detect collisions — two entrypoints mapping to the same action type
      const existing = claimedBy.get(actionType);
      if (existing) {
        console.warn(
          `[action-gen] COLLISION: action type "${actionType}" from ${overlayKey} overwrites ${existing}. ` +
            `Add an explicit actionType to the domain overlay for one of them.`,
        );
        // Remove the earlier duplicate from definitions to avoid schema enum errors
        const idx = definitions.findIndex((d) => d.type === actionType);
        if (idx !== -1) definitions.splice(idx, 1);
      }
      claimedBy.set(actionType, overlayKey);

      // Build param schemas
      const params = buildParamSchemas(ep, overlay?.paramOverrides);

      // Build description
      const description = overlay?.description ?? ep.signature;

      const definition: ActionDefinition = { type: actionType, description, params };
      const route: ActionRoute = {
        contractTag: contract.tag,
        contractAddress: contract.address,
        entrypoint: ep.name,
        overlayKey,
        overlay,
      };

      definitions.push(definition);
      routes.set(actionType, route);

      // Register aliases (share the same route and definition reference)
      if (overlay?.aliases) {
        for (const alias of overlay.aliases) {
          routes.set(alias, route);
        }
      }
    }
  }

  return { definitions, routes };
}

// ── Param schema building ────────────────────────────────────────────────────

function buildParamSchemas(
  ep: ABIEntrypoint,
  paramOverrides?: Record<string, { description?: string; transform?: (v: unknown) => unknown }>,
): ActionParamSchema[] {
  return ep.params.map((p) => {
    const override = paramOverrides?.[p.name];
    return {
      name: p.name,
      type: abiTypeToParamSchemaType(p.rawType),
      description: override?.description ?? `${p.name} (${p.type})`,
      required: true,
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get all action type strings including aliases — used for deduplication
 * when combining ABI-generated actions with composite (hand-written) actions.
 */
export function getAllActionTypes(result: GeneratedActions): string[] {
  return Array.from(result.routes.keys());
}

/**
 * Merge additional (hand-written) action definitions into a generated result.
 * Used for composite actions like move_to that orchestrate multiple base actions.
 */
export function mergeCompositeActions(
  base: GeneratedActions,
  composites: { definition: ActionDefinition; route?: ActionRoute }[],
): GeneratedActions {
  const definitions = [...base.definitions];
  const routes = new Map(base.routes);

  for (const { definition, route } of composites) {
    definitions.push(definition);
    if (route) {
      routes.set(definition.type, route);
    }
  }

  return { definitions, routes };
}
