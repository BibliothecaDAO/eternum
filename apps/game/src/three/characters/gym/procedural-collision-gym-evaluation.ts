import { resolveCollisionGymActorCount, type ProceduralCollisionGymConfig } from "./procedural-collision-gym-config";

export type ProceduralCollisionGymEvaluationStatus = "disabled" | "fail" | "pass" | "sampling";

export interface ProceduralCollisionGymEvaluationInput {
  actorCount: number;
  contactCount: number;
  droppedPairCount: number;
  elapsedSeconds: number;
  impactCount: number;
  maximumOffset: number;
  ragdollCount: number;
}

export interface ProceduralCollisionGymEvaluation {
  reasons: readonly string[];
  status: ProceduralCollisionGymEvaluationStatus;
}

const PAIR_SCENARIO_SECONDS = 3;
const ARROW_SCENARIO_SECONDS = 5;
const MAXIMUM_PRESENTATION_OFFSET = 0.21;

export function evaluateProceduralCollisionGym(
  config: ProceduralCollisionGymConfig,
  input: ProceduralCollisionGymEvaluationInput,
): ProceduralCollisionGymEvaluation {
  if (!config.enabled) return { reasons: [], status: "disabled" };

  if (input.actorCount !== resolveCollisionGymActorCount(config) && input.elapsedSeconds === 0) {
    return { reasons: [], status: "sampling" };
  }

  const invariantFailures = resolveInvariantFailures(config, input);
  if (invariantFailures.length > 0) return { reasons: invariantFailures, status: "fail" };
  if (input.elapsedSeconds < resolveEvaluationSeconds(config)) return { reasons: [], status: "sampling" };

  const outcomeFailures = resolveOutcomeFailures(config, input);
  return outcomeFailures.length > 0 ? { reasons: outcomeFailures, status: "fail" } : { reasons: [], status: "pass" };
}

function resolveInvariantFailures(
  config: ProceduralCollisionGymConfig,
  input: ProceduralCollisionGymEvaluationInput,
): string[] {
  const failures: string[] = [];
  const expectedActors = resolveCollisionGymActorCount(config);
  if (input.actorCount !== expectedActors)
    failures.push(`expected ${expectedActors} actors, received ${input.actorCount}`);
  if (!Number.isFinite(input.maximumOffset)) failures.push("presentation offset was not finite");
  if (input.maximumOffset > MAXIMUM_PRESENTATION_OFFSET) {
    failures.push(
      `presentation offset was ${input.maximumOffset.toFixed(3)}m; budget is ${MAXIMUM_PRESENTATION_OFFSET}m`,
    );
  }
  const droppedPairBudget = config.scenario === "crowd" ? Math.max(2, Math.floor(input.actorCount * 0.05)) : 0;
  if (input.droppedPairCount > droppedPairBudget) {
    failures.push(`collision budget dropped ${input.droppedPairCount} pair(s); budget is ${droppedPairBudget}`);
  }
  return failures;
}

function resolveOutcomeFailures(
  config: ProceduralCollisionGymConfig,
  input: ProceduralCollisionGymEvaluationInput,
): string[] {
  if (config.scenario === "arrow-nonlethal") {
    return [
      ...(input.impactCount < 1 ? ["arrow did not reach the intended target"] : []),
      ...(input.ragdollCount > 0 ? ["nonlethal arrow incorrectly started a ragdoll"] : []),
    ];
  }
  if (config.scenario === "arrow-defeat") {
    return [
      ...(input.impactCount < 1 ? ["defeat arrow did not reach the intended target"] : []),
      ...(input.ragdollCount < 1 ? ["authoritative defeat did not hand off to Jolt"] : []),
    ];
  }
  return [
    ...(input.contactCount < 1 ? ["actors never produced a body contact"] : []),
    ...(input.ragdollCount > 0 ? ["body contact incorrectly started a ragdoll"] : []),
  ];
}

function resolveEvaluationSeconds(config: ProceduralCollisionGymConfig): number {
  return config.scenario === "arrow-defeat" || config.scenario === "arrow-nonlethal"
    ? ARROW_SCENARIO_SECONDS
    : PAIR_SCENARIO_SECONDS;
}
