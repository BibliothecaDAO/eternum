/**
 * ABI → ActionDefinition[] generator.
 *
 * Transforms manifest ABI entrypoints into game-agent ActionDefinition objects
 * that the LLM uses to discover and call actions. Supports optional domain
 * overlays for game-specific enrichments (descriptions, param transforms, etc.).
 */
import type { ActionParamSchema, ActionDefinition } from "@bibliothecadao/game-agent";
import { extractAllFromManifest, getGameEntrypoints, tagMatchesGame, abiTypeToParamSchemaType, describeStructFields } from "./parser";
import type { ABIEntrypoint, ABIParam, ContractABIResult, DomainOverlayMap, Manifest, ActionRoute } from "./types";

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

  // Collect struct definitions from ALL contracts so cross-contract structs resolve
  const globalStructs = new Map<string, ABIParam[]>();
  for (const contract of allContracts) {
    for (const [name, fields] of contract.structs) {
      globalStructs.set(name, fields);
    }
  }
  const structNames = new Set(globalStructs.keys());

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
      const requestedActionType = overlay?.actionType ?? ep.name;
      const actionType = reserveUniqueActionType(requestedActionType, contract.suffix, overlayKey, claimedBy);

      // Build param schemas
      const params = buildParamSchemas(ep, overlay?.paramOverrides, globalStructs, structNames);

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
          const aliasType = reserveUniqueActionType(alias, contract.suffix, `${overlayKey} (alias)`, claimedBy);
          routes.set(aliasType, route);
        }
      }
    }
  }

  return { definitions, routes };
}

function reserveUniqueActionType(
  requestedActionType: string,
  contractSuffix: string,
  ownerKey: string,
  claimedBy: Map<string, string>,
): string {
  if (!claimedBy.has(requestedActionType)) {
    claimedBy.set(requestedActionType, ownerKey);
    return requestedActionType;
  }

  const existing = claimedBy.get(requestedActionType)!;
  let candidate = `${contractSuffix}_${requestedActionType}`;
  let i = 2;
  while (claimedBy.has(candidate)) {
    candidate = `${contractSuffix}_${requestedActionType}_${i}`;
    i += 1;
  }

  console.warn(
    `[action-gen] COLLISION: action type "${requestedActionType}" from ${ownerKey} conflicts with ${existing}. ` +
      `Renaming to "${candidate}". Add an explicit actionType in overlays to control the public name.`,
  );
  claimedBy.set(candidate, ownerKey);
  return candidate;
}

// ── Param schema building ────────────────────────────────────────────────────

function buildParamSchemas(
  ep: ABIEntrypoint,
  paramOverrides?: Record<string, { description?: string; transform?: (v: unknown) => unknown }>,
  structs?: Map<string, ABIParam[]>,
  structNames?: Set<string>,
): ActionParamSchema[] {
  return ep.params.map((p) => {
    const override = paramOverrides?.[p.name];
    const schemaType = abiTypeToParamSchemaType(p.rawType, structNames);

    // For struct params, include field descriptions so the LLM knows the shape.
    // If the domain overlay already provides a curated description, trust it.
    let description = override?.description ?? `${p.name} (${p.type})`;
    if (structs && !override?.description) {
      const structDesc = describeStructFields(p.rawType, structs);
      if (structDesc) {
        description = `${p.name} — pass as object: ${structDesc}`;
      }
    }

    return {
      name: p.name,
      type: schemaType,
      description,
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
