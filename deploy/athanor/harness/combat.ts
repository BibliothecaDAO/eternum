import type { ID } from "@bibliothecadao/types";
import type { TrackedTransaction } from "./driver";
import { rejectionOf, type Rejection } from "./rejections";

/** A hostile target one of a bot's explorers can attack now: the client planned an attack path to it. */
export interface BattleCandidate {
  explorerId: ID;
  targetId: ID;
  target: "explorer" | "structure";
  distance: number;
}

/** The rejections that are the game's legal answer to an attack that can no longer happen as planned. */
const BATTLE_REFUSALS = [
  "stamina",
  "cooldown",
  "out_of_range",
  "target_gone",
  "attacker_gone",
  "combatant_gone",
  "immunity",
] as const satisfies readonly Rejection[];

export type BattleRefusal = (typeof BATTLE_REFUSALS)[number];

export type BattleOutcome =
  | { result: "succeeded" }
  | { result: "refused"; reason: BattleRefusal }
  | { result: "failed" };

export interface BattleSummary {
  attempted: number;
  succeeded: number;
  refused: Partial<Record<BattleRefusal, number>>;
  failed: number;
}

/** An enemy explorer before any structure, then the nearest, then the lowest ids so every run picks the same one. */
export function pickBattle(candidates: readonly BattleCandidate[]): BattleCandidate | undefined {
  return [...candidates].sort(
    (left, right) =>
      Number(right.target === "explorer") - Number(left.target === "explorer") ||
      left.distance - right.distance ||
      left.explorerId - right.explorerId ||
      left.targetId - right.targetId,
  )[0];
}

/**
 * A battle the chain ran succeeded. One the game refused (out of stamina or on cooldown, the target moved or fell,
 * immunity) is a legal answer and is counted as refused. Anything else, a transport, calldata or harness error or a
 * refusal the bot caused, is a failure.
 */
export function classifyBattleOutcome(action: Pick<TrackedTransaction, "outcome" | "error">): BattleOutcome {
  if (action.outcome === "completed") return { result: "succeeded" };
  const rejection = /Native action rejected: GAMEPLAY_REJECTED: (.*)/.exec(action.error ?? "")?.[1];
  if (action.outcome !== "rejected" || rejection === undefined) return { result: "failed" };
  const reason = rejectionOf(rejection);
  return isBattleRefusal(reason) ? { result: "refused", reason } : { result: "failed" };
}

const isBattleRefusal = (reason: Rejection | undefined): reason is BattleRefusal =>
  (BATTLE_REFUSALS as readonly (Rejection | undefined)[]).includes(reason);

export function summarizeBattles(actions: readonly Pick<TrackedTransaction, "kind" | "outcome" | "error">[]) {
  const summary: BattleSummary = { attempted: 0, succeeded: 0, refused: {}, failed: 0 };
  for (const action of actions) {
    if (action.kind !== "attack") continue;
    summary.attempted += 1;
    const outcome = classifyBattleOutcome(action);
    if (outcome.result === "succeeded") summary.succeeded += 1;
    else if (outcome.result === "failed") summary.failed += 1;
    else summary.refused[outcome.reason] = (summary.refused[outcome.reason] ?? 0) + 1;
  }
  return summary;
}

export function addBattleSummaries(summaries: readonly BattleSummary[]): BattleSummary {
  const total: BattleSummary = { attempted: 0, succeeded: 0, refused: {}, failed: 0 };
  for (const summary of summaries) {
    total.attempted += summary.attempted;
    total.succeeded += summary.succeeded;
    total.failed += summary.failed;
    for (const [reason, count] of Object.entries(summary.refused) as [BattleRefusal, number][])
      total.refused[reason] = (total.refused[reason] ?? 0) + count;
  }
  return total;
}
