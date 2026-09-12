import {
  ActionPaths,
  buildArmyPathIndexes,
  getBlockTimestamp,
  getGuardsByStructure,
  gameEntityKey,
  type ActionPath,
  type GameClient,
} from "@bibliothecadao/eternum";
import { classifyTransactionError, type ClassifiedTransactionError } from "@bibliothecadao/provider/errors";
import { getTroopAttackRange, type HexPosition, type ID, type TroopType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

import type { RunnerGame } from "../game";
import { ACTION_CATALOG, ACTION_NAMES, type ActionName } from "./action-catalog";
import { clipList, textResult } from "./result";
import { StringEnum } from "./schema";

const ActParams = Type.Object({
  action: StringEnum(ACTION_NAMES, "An action name from list_actions."),
  params: Type.Object(
    {},
    { additionalProperties: true, description: "The action's parameters, as list_actions documents them." },
  ),
});

type ActInput = Static<typeof ActParams>;
type Params = Record<string, unknown>;
type PlannerName = "armyPaths" | "structurePaths";
type SubmitName = Exclude<ActionName, PlannerName>;

type ActOutcome =
  | { kind: "planned"; paths: string[] }
  | { kind: "confirmed"; transactionHash: string; block: number | null }
  | { kind: "refused"; reason: string }
  | { kind: "failed"; transactionHash: string | null; error: ClassifiedTransactionError };

const PATH_LIST_LIMIT = 15;

export const createActTool = (game: RunnerGame): AgentTool<typeof ActParams> => ({
  name: "act",
  label: "Act",
  description:
    "Run one game action. Submitting actions sign with my account and wait for the chain to confirm; the result is the confirmation or the classified failure.",
  parameters: ActParams,
  execute: async (_id, input) => {
    const outcome = await runAction(game, input);
    return textResult(renderOutcome(input.action, outcome), outcome);
  },
});

export const runAction = async (game: RunnerGame, input: ActInput): Promise<ActOutcome> => {
  const params = input.params as Params;
  const invalid = describeInvalidParams(input.action, params);
  if (invalid) return { kind: "refused", reason: invalid };
  if (isPlanner(input.action)) return plan(game.client, input.action, params);
  if (!game.client.signer) {
    return { kind: "refused", reason: "no signer: this runner is spectating (--signer none) and cannot submit" };
  }
  return submit(game.client, input.action, params);
};

const describeInvalidParams = (action: ActionName, params: Params): string | null => {
  const schema = ACTION_CATALOG[action].params;
  if (Value.Check(schema, params)) return null;
  const errors = [...Value.Errors(schema, params)].map(
    (error) => `${error.instancePath || "params"}: ${error.message}`,
  );
  return `invalid params — ${errors.join("; ")}`;
};

const isPlanner = (action: ActionName): action is PlannerName => !ACTION_CATALOG[action].submits;

// Read-only planners

const plan = (client: GameClient, action: PlannerName, params: Params): ActOutcome => {
  const paths =
    action === "armyPaths"
      ? armyPaths(client, params.explorerId as ID)
      : structurePaths(client, params.structureId as ID);
  return { kind: "planned", paths: [...paths.getPaths().values()].map(describePath) };
};

const armyPaths = (client: GameClient, explorerId: ID): ActionPaths => {
  const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();
  return client.actions.armyPaths({
    explorerId,
    ...buildArmyPathIndexes(client),
    currentDefaultTick,
    currentArmiesTick,
    playerAddress: viewerOf(client),
  });
};

const structurePaths = (client: GameClient, structureId: ID): ActionPaths => {
  const structure = structureRow(client, structureId);
  if (!structure) throw new Error(`Structure ${structureId} is not in RECS`);
  const { armyHexes, exploredHexes } = buildArmyPathIndexes(client);
  return client.actions.structurePaths({
    hex: { col: structure.base.coord_x, row: structure.base.coord_y },
    armyHexes,
    exploredHexes,
    playerAddress: viewerOf(client),
    attackRange: guardAttackRange(structure),
  });
};

/** The reach of the strongest-ranged guard with troops, as the worldmap computes it on structure selection. */
const guardAttackRange = (structure: NonNullable<ReturnType<typeof structureRow>>): number =>
  Math.max(
    0,
    ...getGuardsByStructure(structure)
      .filter((guard) => Number(guard.troops.count) > 0)
      .map((guard) => getTroopAttackRange(guard.troops.category as TroopType)),
  );

const structureRow = (client: GameClient, structureId: ID) =>
  getComponentValue(client.setup.components.Structure, gameEntityKey([BigInt(structureId)]));

// Submitting actions

const submit = async (client: GameClient, action: SubmitName, params: Params): Promise<ActOutcome> => {
  const capture = captureNextTransactionHash(client);
  try {
    if (action === "moveArmy") {
      const refusal = await moveArmy(client, params);
      if (refusal) return refusal;
    } else {
      await dispatch(client, action, params);
    }
    const transactionHash = capture.hash();
    if (!transactionHash) return { kind: "refused", reason: "the action completed without submitting a transaction" };
    const transaction = await client.runtime.waitForTransaction(transactionHash);
    return { kind: "confirmed", transactionHash, block: transaction.block };
  } catch (error) {
    return { kind: "failed", transactionHash: capture.hash(), error: classifyTransactionError(error) };
  } finally {
    capture.stop();
  }
};

/** A move's path comes from the planner: the target must be one of the hexes armyPaths returned for this explorer. */
const moveArmy = async (client: GameClient, params: Params): Promise<ActOutcome | null> => {
  const explorerId = params.explorerId as ID;
  const target = params.target as HexPosition;
  const paths = armyPaths(client, explorerId);
  const path = paths.get(ActionPaths.posKey(target));
  if (!path) {
    const reachable = [...paths.getPaths().values()].map(describePath);
    return {
      kind: "refused",
      reason: `(${target.col},${target.row}) is not reachable by explorer ${explorerId}. ${renderPaths(reachable)}`,
    };
  }
  await client.actions.moveArmy({ explorerId, path, currentArmiesTick: getBlockTimestamp().currentArmiesTick });
  return null;
};

const dispatch = (client: GameClient, action: Exclude<SubmitName, "moveArmy">, params: Params) =>
  // The catalog schema validated the shape; the typed client input is what the schema documents.
  client.actions[action](params as never);

/** The provider announces every hash it sent; the runner submits one action at a time, so the next one is ours. */
const captureNextTransactionHash = (client: GameClient) => {
  const provider = client.setup.network.provider;
  let hash: string | null = null;
  const onSubmitted = (event: { transactionHash: string }) => {
    hash ??= event.transactionHash;
  };
  provider.on("transactionSubmitted", onSubmitted);
  return { hash: () => hash, stop: () => provider.off("transactionSubmitted", onSubmitted) };
};

const viewerOf = (client: GameClient) => BigInt(client.signer?.address ?? 0);

// Rendering

const renderOutcome = (action: ActionName, outcome: ActOutcome): string => {
  switch (outcome.kind) {
    case "planned":
      return `${action}: ${renderPaths(outcome.paths)}`;
    case "confirmed":
      return `${action} confirmed in block ${outcome.block ?? "pending"} (tx ${outcome.transactionHash})`;
    case "refused":
      return `${action} refused: ${outcome.reason}`;
    case "failed":
      return `${action} failed (${outcome.error.kind})${outcome.error.reason ? `: ${outcome.error.reason}` : ""}${outcome.transactionHash ? ` tx ${outcome.transactionHash}` : ""}`;
  }
};

const renderPaths = (paths: string[]): string =>
  paths.length === 0
    ? "nothing is reachable now"
    : `${paths.length} reachable: ${clipList(paths, PATH_LIST_LIMIT).join("; ")}`;

const describePath = (path: ActionPath[]): string => {
  const last = path[path.length - 1]!;
  const cost = last.staminaCost !== undefined ? ` ${last.staminaCost} stamina` : "";
  return `${last.actionType} (${last.hex.col},${last.hex.row})${cost}`;
};
