/**
 * ABI-driven action registry.
 *
 * Replaces the old hardcoded action tables with dynamic generation from
 * manifest ABIs + domain overlays. All standard game actions are handled by
 * the ABI executor (Contract.populate + account.execute). Only a small number
 * of quality-of-life composites stay hand-written.
 */
import type { EternumClient } from "@bibliothecadao/client";
import type { ActionResult, GameAction, ActionDefinition } from "@bibliothecadao/game-agent";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { CallData, type Account, type Call } from "starknet";
import { generateActions, mergeCompositeActions } from "../abi/action-gen";
import { createABIExecutor, type ABIExecutor } from "../abi/executor";
import { ETERNUM_OVERLAYS, createHiddenOverlays, num, bool, numArray } from "../abi/domain-overlay";
import { getDirectionBetweenAdjacentHexes } from "@bibliothecadao/types";
import type { Manifest } from "../abi/types";
import { moveExplorer } from "./move-executor";
import { buildWorldState, type EternumWorldState, toContract } from "./world-state";

// ---------------------------------------------------------------------------
// Module state — populated by initializeActions()
// ---------------------------------------------------------------------------

let _executor: ABIExecutor | undefined;
let _actionDefs: ActionDefinition[] = [];
let _actionTypes = new Set<string>();
let _initialized = false;

/** Token addresses from world profile, used by approve_token action. */
export interface TokenConfig {
  feeToken?: string;
  entryToken?: string;
  worldAddress?: string;
}
let _tokenConfig: TokenConfig = {};
let _blitzSystemsAddress: string | undefined;

const BLITZ_SETTLE_GRANT_STARTING_TROOPS = "1";

// ---------------------------------------------------------------------------
// Cached world state — updated every tick, used for pre-flight validation.
// ---------------------------------------------------------------------------

let _cachedWorldState: EternumWorldState | undefined;

/** Cache the latest world state for pre-flight validation in action handlers. */
export function setCachedWorldState(state: EternumWorldState) {
  _cachedWorldState = state;
}

// ---------------------------------------------------------------------------
// World state provider for move_to
// ---------------------------------------------------------------------------

let _worldStateProvider: ((client: EternumClient) => Promise<EternumWorldState>) | undefined;

/**
 * Set the world state provider so move_to can fetch current tile map.
 * Call once during adapter initialization with the account address.
 */
export function setWorldStateProvider(accountAddress: string) {
  _worldStateProvider = (client: EternumClient) => buildWorldState(client, accountAddress);
}

// ---------------------------------------------------------------------------
// Debug logging
// ---------------------------------------------------------------------------

function logAction(actionType: string, result: ActionResult) {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug",
      "actions.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    const status = result.success ? `OK tx=${result.txHash}` : `FAIL: ${result.error}`;
    writeFileSync(debugPath, `[${ts}] ${actionType} => ${status}\n`, { flag: "a" });
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the ABI-driven action registry from a manifest.
 *
 * Must be called before getActionDefinitions() or executeAction().
 * Typically called from EternumGameAdapter constructor.
 */
export function initializeActions(
  manifest: Manifest,
  account: Account,
  options: { gameName?: string; tokenConfig?: TokenConfig } = {},
) {
  _tokenConfig = options.tokenConfig ?? {};

  // Build overlays (domain enrichments + hidden admin entrypoints)
  const hiddenOverlays = createHiddenOverlays(manifest);
  const overlays = { ...ETERNUM_OVERLAYS, ...hiddenOverlays };

  // Generate action definitions and routing table from manifest ABIs
  const generated = generateActions(manifest, {
    overlays,
    gameName: options.gameName,
  });

  // Look up the blitz contract address from routes for UX descriptions.
  const blitzRoute = Array.from(generated.routes.values()).find(
    (route) => route.contractTag.includes("blitz_realm_systems") && route.entrypoint === "settle",
  );
  const blitzAddress = blitzRoute?.contractAddress;
  _blitzSystemsAddress = blitzAddress;

  // Build dynamic description for approve_token with known addresses
  let approveDesc =
    "Approve a spender to transfer ERC-20 tokens on your behalf. " +
    "Required before Blitz settlement when the world charges an entry fee: approve the fee token for the blitz contract, then call settle.";
  if (_tokenConfig.feeToken) approveDesc += ` Fee token: ${_tokenConfig.feeToken}.`;
  if (blitzAddress) approveDesc += ` Blitz contract (spender): ${blitzAddress}.`;

  // Add composite actions that orchestrate multiple base actions
  const withComposites = mergeCompositeActions(generated, [
    {
      definition: {
        type: "move_to",
        description:
          "Move an explorer to a target coordinate using A* pathfinding. Automatically computes the optimal path, " +
          "batches travel/explore actions, and executes them sequentially. Stops on first failure.",
        params: [
          { name: "explorerId", type: "number", description: "Explorer entity ID to move", required: true },
          {
            name: "targetCol",
            type: "number",
            description: "Target column (x) — use the display coordinates shown in world state",
            required: true,
          },
          {
            name: "targetRow",
            type: "number",
            description: "Target row (y) — use the display coordinates shown in world state",
            required: true,
          },
        ],
      },
    },
    {
      definition: {
        type: "approve_token",
        description: approveDesc,
        params: [
          { name: "token_address", type: "string", description: "Token contract address to approve", required: true },
          {
            name: "spender",
            type: "string",
            description: "Contract address allowed to spend your tokens",
            required: true,
          },
          {
            name: "amount",
            type: "string",
            description:
              "Amount to approve in base units (wei). Use '340282366920938463463374607431768211455' for max u128 approval.",
            required: true,
          },
        ],
      },
    },
  ]);

  _actionDefs = withComposites.definitions;
  _actionTypes = new Set(withComposites.routes.keys());
  _actionTypes.add("move_to"); // Not in routes (composite)
  _actionTypes.add("approve_token"); // Not in routes (composite)

  // Create ABI executor for standard actions
  _executor = createABIExecutor(manifest, account, {
    routes: withComposites.routes,
    cachedStateProvider: () => _cachedWorldState,
    onAfterExecute: logAction,
  });

  _initialized = true;
}

// ---------------------------------------------------------------------------
// move_to handler (composite action)
// ---------------------------------------------------------------------------

async function handleMoveTo(
  client: EternumClient,
  signer: Account,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  if (!_worldStateProvider) {
    return { success: false, error: "World state provider not initialized. Call setWorldStateProvider first." };
  }

  const worldState = await _worldStateProvider(client);

  const targetCol = toContract(num(params.targetCol));
  const targetRow = toContract(num(params.targetRow));

  const result = await moveExplorer(
    client,
    signer,
    {
      explorerId: num(params.explorerId),
      targetCol,
      targetRow,
    },
    worldState,
  );

  if (!result.success) {
    return { success: false, error: result.summary };
  }

  return {
    success: true,
    data: {
      summary: result.summary,
      stepsExecuted: result.steps.length,
      totalCost: result.pathResult.totalCost,
      txHashes: result.steps.map((s) => s.result.txHash).filter(Boolean),
    },
  };
}

// ---------------------------------------------------------------------------
// approve_token handler (composite action)
// ---------------------------------------------------------------------------

async function handleApproveToken(signer: Account, params: Record<string, unknown>): Promise<ActionResult> {
  const tokenAddress = String(params.token_address ?? params.tokenAddress ?? "");
  const spender = String(params.spender ?? "");
  const rawAmount = BigInt(String(params.amount ?? "0"));

  if (!tokenAddress || !spender) {
    return { success: false, error: "token_address and spender are required" };
  }

  // Split into uint256 (low, high) for starknet calldata
  const low = (rawAmount & ((1n << 128n) - 1n)).toString();
  const high = (rawAmount >> 128n).toString();

  try {
    const result = await signer.execute({
      contractAddress: tokenAddress,
      entrypoint: "approve",
      calldata: [spender, low, high],
    });
    const txHash = result?.transaction_hash ?? (result as any)?.transactionHash;
    return { success: true, txHash };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function buildBlitzEntryTokenApprovalCall(approved: boolean): Call {
  return {
    contractAddress: _tokenConfig.entryToken!,
    entrypoint: "set_approval_for_all",
    calldata: CallData.compile([_blitzSystemsAddress!, approved]),
  };
}

function buildBlitzSettleCall({
  name,
  entryTokenId,
  cosmeticTokenIds,
}: {
  name: string;
  entryTokenId: string;
  cosmeticTokenIds: string[];
}): Call {
  return {
    contractAddress: _blitzSystemsAddress!,
    entrypoint: "settle",
    calldata: CallData.compile([
      name,
      entryTokenId,
      cosmeticTokenIds.length.toString(),
      ...cosmeticTokenIds,
      BLITZ_SETTLE_GRANT_STARTING_TROOPS,
    ]),
  };
}

function buildBlitzSettleCalls({
  name,
  entryTokenId,
  cosmeticTokenIds,
}: {
  name: string;
  entryTokenId: string;
  cosmeticTokenIds: string[];
}): Call[] {
  const calls: Call[] = [];

  if (_tokenConfig.entryToken) {
    calls.push(buildBlitzEntryTokenApprovalCall(true));
  }

  calls.push(
    buildBlitzSettleCall({
      name,
      entryTokenId,
      cosmeticTokenIds,
    }),
  );

  if (_tokenConfig.entryToken) {
    calls.push(buildBlitzEntryTokenApprovalCall(false));
  }

  return calls;
}

async function handleBlitzSettleWithTemporaryCollectionApproval(
  signer: Account,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  if (!_blitzSystemsAddress) {
    return { success: false, error: "Blitz settle route not initialized." };
  }

  const name = String(params.name ?? "");
  const entryTokenId = String(params.entry_token_id ?? params.entryTokenId ?? "1");
  const cosmeticTokenIds = toStringArray(params.cosmetic_token_ids ?? params.cosmeticTokenIds);

  try {
    const result = await signer.execute(
      buildBlitzSettleCalls({
        name,
        entryTokenId,
        cosmeticTokenIds,
      }),
    );
    const txHash = result?.transaction_hash ?? (result as any)?.transactionHash;
    return { success: true, txHash };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

// ---------------------------------------------------------------------------
// move_explorer handler — uses provider for explore (VRF multicall), ABI for travel
// ---------------------------------------------------------------------------

async function handleMoveExplorer(
  client: EternumClient,
  signer: Account,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const explorerId = num(params.explorer_id ?? params.explorerId);
  const directions = numArray(params.directions);
  const explore = bool(params.explore);

  if (!explorerId) {
    return { success: false, error: "explorer_id is required" };
  }
  if (directions.length === 0) {
    return { success: false, error: "directions must be a non-empty array" };
  }

  if (explore) {
    // Explore requires VRF + move + extract_reward as a multicall.
    // client.troops.explore() does this correctly via the provider.
    try {
      const result = await client.troops.explore(signer as any, {
        explorerId,
        directions,
      });
      const txHash = result?.transaction_hash ?? (result as any)?.transactionHash;
      return { success: true, txHash };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  // Travel (explore=false) — single call, no VRF needed. Fall through to ABI executor.
  if (!_executor) {
    return { success: false, error: "Action registry not initialized." };
  }
  return _executor.execute({ type: "explorer_move", params });
}

// ---------------------------------------------------------------------------
// add_to_explorer handler — auto-compute home_direction
// ---------------------------------------------------------------------------

async function handleAddToExplorer(
  client: EternumClient,
  signer: Account,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const explorerId = num(params.to_explorer_id ?? params.toExplorerId);
  const amount = params.amount;

  if (!explorerId) {
    return { success: false, error: "to_explorer_id is required" };
  }
  if (!amount) {
    return { success: false, error: "amount is required" };
  }

  // Look up explorer and its home structure from cached world state
  if (!_cachedWorldState) {
    return { success: false, error: "World state not available. Wait for next tick." };
  }

  const explorer = _cachedWorldState.entities.find((e) => e.entityId === explorerId && e.type === "army" && e.isOwned);
  if (!explorer) {
    return { success: false, error: `Explorer #${explorerId} not found in your armies.` };
  }

  // Find the explorer's home structure — the nearest owned structure
  const ownedStructures = _cachedWorldState.entities.filter((e) => e.type === "structure" && e.isOwned);
  if (ownedStructures.length === 0) {
    return { success: false, error: "No owned structures found." };
  }

  // Try to find an adjacent structure
  let homeDirection: number | null = null;
  let homeStructure: (typeof ownedStructures)[0] | undefined;

  for (const s of ownedStructures) {
    const dir = getDirectionBetweenAdjacentHexes(
      { col: explorer.position.x, row: explorer.position.y },
      { col: s.position.x, row: s.position.y },
    );
    if (dir !== null) {
      homeDirection = dir;
      homeStructure = s;
      break;
    }
  }

  if (homeDirection === null || !homeStructure) {
    const explorerPos = `(${explorer.position.x},${explorer.position.y})`;
    const structPositions = ownedStructures.map((s) => `#${s.entityId} @(${s.position.x},${s.position.y})`).join(", ");
    return {
      success: false,
      error: `Explorer #${explorerId} at ${explorerPos} is not adjacent to any owned structure. Structures: ${structPositions}. Move the explorer adjacent first.`,
    };
  }

  // Pass through to ABI executor with computed home_direction
  if (!_executor) {
    return { success: false, error: "Action registry not initialized." };
  }
  return _executor.execute({
    type: "explorer_add",
    params: {
      to_explorer_id: explorerId,
      amount,
      home_direction: homeDirection,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all action definitions (type + description + param schemas).
 * Used to build enriched tool descriptions for the LLM.
 */
export function getActionDefinitions(): ActionDefinition[] {
  return _actionDefs;
}

/**
 * Return the list of all registered action type strings.
 */
export function getAvailableActions(): string[] {
  return Array.from(_actionTypes);
}

/**
 * Look up a registered action handler by its type string.
 * @deprecated Use executeAction() instead.
 */
export function getActionHandler(
  type: string,
): ((client: EternumClient, signer: Account, params: Record<string, unknown>) => Promise<ActionResult>) | undefined {
  if (!_actionTypes.has(type)) return undefined;
  // Return a function that delegates to executeAction
  return (client, signer, params) => executeAction(client, signer, { type, params });
}

/**
 * Execute a GameAction by dispatching to the ABI executor or composite handler.
 * Returns a failed ActionResult if the action type is unknown.
 */
export async function executeAction(client: EternumClient, signer: Account, action: GameAction): Promise<ActionResult> {
  // Composite actions handled specially
  if (action.type === "move_to") {
    const result = await handleMoveTo(client, signer, action.params);
    logAction(action.type, result);
    return result;
  }

  // explorer_move with explore=true needs VRF multicall via provider
  if (action.type === "explorer_move" && bool(action.params.explore)) {
    const result = await handleMoveExplorer(client, signer, action.params);
    logAction(action.type, result);
    return result;
  }

  // explorer_add — auto-compute home_direction from world state
  if (action.type === "explorer_add") {
    const result = await handleAddToExplorer(client, signer, action.params);
    logAction(action.type, result);
    return result;
  }

  if (action.type === "approve_token") {
    const result = await handleApproveToken(signer, action.params);
    logAction(action.type, result);
    return result;
  }

  if (action.type === "settle" && _tokenConfig.entryToken) {
    const result = await handleBlitzSettleWithTemporaryCollectionApproval(signer, action.params);
    logAction(action.type, result);
    return result;
  }

  // Standard ABI actions
  if (!_executor) {
    return {
      success: false,
      error: "Action registry not initialized. Call initializeActions() first.",
    };
  }

  // The ABI executor's onAfterExecute hook handles logging for standard actions
  return _executor.execute(action);
}
