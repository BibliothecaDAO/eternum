/**
 * ABI-driven action registry.
 *
 * Replaces the old hardcoded register() calls with dynamic generation from
 * manifest ABIs + domain overlays. All standard game actions are handled by
 * the ABI executor (Contract.populate + account.execute). The composite
 * "move_to" action is the only hand-written handler.
 */
import type { EternumClient } from "@bibliothecadao/client";
import type { ActionResult, GameAction } from "@bibliothecadao/game-agent";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Account } from "starknet";
import { generateActions, mergeCompositeActions } from "../abi/action-gen";
import { createABIExecutor, type ABIExecutor } from "../abi/executor";
import { ETERNUM_OVERLAYS, createHiddenOverlays, num } from "../abi/domain-overlay";
import type { Manifest } from "../abi/types";
import { moveExplorer } from "./move-executor";
import { buildWorldState, type EternumWorldState } from "./world-state";

// Re-declared here to avoid tsup d.ts resolution issues with game-agent.
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
      "debug-actions.log",
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

  // Look up the blitz contract address from routes for the approve description
  const blitzRoute = generated.routes.get("obtain_entry_token");
  const blitzAddress = blitzRoute?.contractAddress;

  // Build dynamic description for approve_token with known addresses
  let approveDesc =
    "Approve a spender to transfer ERC-20 tokens on your behalf. " +
    "Required before Blitz registration: approve the fee token for the blitz contract, then call obtain_entry_token.";
  if (_tokenConfig.feeToken) approveDesc += ` Fee token: ${_tokenConfig.feeToken}.`;
  if (_tokenConfig.entryToken) approveDesc += ` Entry token: ${_tokenConfig.entryToken}.`;
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
          { name: "targetCol", type: "number", description: "Target column (x coordinate)", required: true },
          { name: "targetRow", type: "number", description: "Target row (y coordinate)", required: true },
        ],
      },
    },
    {
      definition: {
        type: "approve_token",
        description: approveDesc,
        params: [
          { name: "token_address", type: "string", description: "Token contract address to approve", required: true },
          { name: "spender", type: "string", description: "Contract address allowed to spend your tokens", required: true },
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

  const result = await moveExplorer(client, signer, {
    explorerId: num(params.explorerId),
    targetCol: num(params.targetCol),
    targetRow: num(params.targetRow),
  }, worldState);

  if (!result.success) {
    return { success: false, error: result.summary };
  }

  return {
    success: true,
    data: {
      summary: result.summary,
      stepsExecuted: result.steps.length,
      totalCost: result.pathResult.totalCost,
      txHashes: result.steps
        .map((s) => s.result.txHash)
        .filter(Boolean),
    },
  };
}

// ---------------------------------------------------------------------------
// approve_token handler (composite action)
// ---------------------------------------------------------------------------

async function handleApproveToken(
  signer: Account,
  params: Record<string, unknown>,
): Promise<ActionResult> {
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
export function getActionHandler(type: string): ((client: EternumClient, signer: Account, params: Record<string, unknown>) => Promise<ActionResult>) | undefined {
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

  if (action.type === "approve_token") {
    const result = await handleApproveToken(signer, action.params);
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
