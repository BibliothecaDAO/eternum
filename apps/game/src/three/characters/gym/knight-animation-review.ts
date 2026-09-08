import {
  applyProceduralUnitConfigPatch,
  createDefaultProceduralUnitConfig,
  type ProceduralUnitConfig,
} from "../procedural-unit-config";
import {
  createProceduralAnimationCapturePlan,
  type ProceduralAnimationCaptureResult,
  type ProceduralAnimationCaptureSequence,
} from "./procedural-animation-capture";
import { evaluateAnimationCoverage } from "./procedural-animation-evidence.mjs";
import { evaluateProceduralAnimationCapture } from "./procedural-animation-evaluation";

export const KNIGHT_REVIEW_ANIMATIONS = [
  { id: "knight-walk", label: "Walk", mode: "walk", sequence: "locomotion-cycle" },
  { id: "knight-run", label: "Run", mode: "run", sequence: "locomotion-cycle" },
  { id: "knight-idle", label: "Idle", mode: "idle", sequence: "idle-hold" },
  { id: "knight-attack", label: "Sword attack", mode: "idle", sequence: "melee-attack" },
] as const;
export type KnightAnimationId = (typeof KNIGHT_REVIEW_ANIMATIONS)[number]["id"];

export function resolveKnightReviewSequence(id: KnightAnimationId): ProceduralAnimationCaptureSequence {
  return resolveKnightAnimation(id).sequence;
}

function resolveKnightAnimation(id: unknown) {
  const animation = KNIGHT_REVIEW_ANIMATIONS.find((entry) => entry.id === id);
  if (!animation) throw new Error(`Unsupported knight animation: ${String(id)}`);
  return animation;
}

export interface KnightAnimationScenario {
  schemaVersion: 1;
  id: KnightAnimationId;
  config: ProceduralUnitConfig;
  rootMotionSpeed: number;
}

export interface KnightAnimationReviewRun {
  id: string;
  createdAt: string;
  scenario: KnightAnimationScenario;
  environment: { renderer: string; viewport: string; assetHash: string; userAgent: string };
  temporal: ProceduralAnimationCaptureResult;
  atlas: ProceduralAnimationCaptureResult;
  repeat: { passed: boolean; firstDifference: string | null };
}

export function createKnightAnimationScenario(id: KnightAnimationId = "knight-walk"): KnightAnimationScenario {
  const animation = resolveKnightAnimation(id);
  const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
    kind: "knight",
    humanoid: { appearanceId: "universal-base", tier: 1, seed: 1337, animationMode: animation.mode, autoRotate: false },
    archer: { autoFire: false },
    melee: { autoAttack: false },
  });
  const plan = createProceduralAnimationCapturePlan(config, "all-frames", { sequence: animation.sequence });
  return { schemaVersion: 1, id, config, rootMotionSpeed: plan.rootMotionSpeed };
}

export function readKnightAnimationScenario(value: unknown): KnightAnimationScenario {
  const animation = resolveKnightAnimation((value as { id?: unknown } | null)?.id);
  const reference = createKnightAnimationScenario(animation.id);
  assertMatchingShape(value, reference, "scenario");
  const scenario = value as KnightAnimationScenario;
  const normalized = applyProceduralUnitConfigPatch(scenario.config, scenario.config);
  if (firstValueDifference(scenario.config, normalized))
    throw new Error("Scenario contains out-of-range configuration");
  if (hasDifferentKnightAnimationFixture(scenario, reference)) {
    throw new Error(
      "This review requires the selected knight animation, Universal Base model, seed, timestep, loadout and root speed. Load the selected animation first.",
    );
  }
  if (
    resolveKnightReviewSequence(scenario.id) === "locomotion-cycle" &&
    (scenario.config.humanoid.animationSpeed <= 0 || scenario.config.humanoid.stride <= 0)
  ) {
    throw new Error("Locomotion requires positive animation speed and stride");
  }
  return structuredClone(scenario);
}

export function compareKnightAnimationRuns(baseline: KnightAnimationReviewRun, candidate: KnightAnimationReviewRun) {
  const environmentDifference = firstValueDifference(baseline.environment, candidate.environment, "environment");
  const planDifference = firstValueDifference(
    reviewCaptureConditions(baseline.temporal),
    reviewCaptureConditions(candidate.temporal),
    "capture",
  );
  const coverageFailure = [
    ...evaluateAnimationCoverage(baseline.temporal).failures,
    ...evaluateAnimationCoverage(candidate.temporal).failures,
  ][0];
  const incompatible =
    baseline.scenario.id !== candidate.scenario.id
      ? "different knight animations"
      : (environmentDifference ?? planDifference ?? coverageFailure);
  const changedParameters = collectChangedValues(baseline.scenario.config, candidate.scenario.config);
  const firstPoseDifference = incompatible ? null : firstCaptureDifference(baseline.temporal, candidate.temporal);
  const failures = reviewRunFailures(candidate);
  const baselineFailures = reviewRunFailures(baseline);
  return {
    compatible: !incompatible,
    incompatible,
    changedParameters,
    firstPoseDifference,
    timingChanged: firstValueDifference(baseline.temporal.plan, candidate.temporal.plan) !== null,
    failures,
    baselineFailures,
  };
}

export function firstCaptureDifference(
  left: ProceduralAnimationCaptureResult,
  right: ProceduralAnimationCaptureResult,
): string | null {
  const planDifference = firstValueDifference(left.plan, right.plan, "plan");
  if (planDifference) return planDifference;
  if (left.frames.length !== right.frames.length) return "frame count";
  for (let index = 0; index < left.frames.length; index += 1) {
    const a = left.frames[index];
    const b = right.frames[index];
    const difference = firstValueDifference(
      { diagnostics: a.diagnostics, runtimePhase: a.runtimePhase, issues: a.issues },
      { diagnostics: b.diagnostics, runtimePhase: b.runtimePhase, issues: b.issues },
      `F${a.frameIndex}`,
    );
    if (difference) return difference;
  }
  return null;
}

export function reviewRunFailures(run: KnightAnimationReviewRun): string[] {
  const failures: string[] = [];
  for (const [name, capture] of [
    ["temporal", run.temporal],
    ["atlas", run.atlas],
  ] as const) {
    const expectedPlan = createProceduralAnimationCapturePlan(
      run.scenario.config,
      name === "temporal" ? "all-frames" : "phase-atlas",
      {
        sequence: resolveKnightReviewSequence(run.scenario.id),
        rootMotionSpeed: run.scenario.rootMotionSpeed,
        overlay: name === "temporal" ? "clean" : "diagnostic",
      },
    );
    if (firstValueDifference(capture.plan, expectedPlan)) failures.push(`${name}: scenario plan mismatch`);
    if (firstValueDifference(capture.config, run.scenario.config)) failures.push(`${name}: scenario config mismatch`);
    const evaluation = evaluateProceduralAnimationCapture(capture);
    if (!evaluation.automatedHardGatePassed) failures.push(`${name}: objective gate failed`);
    failures.push(...evaluation.footRollFailures.map((failure) => `${name}: ${failure}`));
    failures.push(...evaluation.coverageFailures.map((failure) => `${name}: ${failure}`));
    for (const frame of capture.frames) {
      failures.push(...frame.issues.map((issue) => `${name} F${frame.frameIndex}: ${issue}`));
      if (frame.views.some((view) => !view.imageDataUrl?.startsWith("data:image/webp;base64,"))) {
        failures.push(`${name} F${frame.frameIndex}: missing image`);
      }
    }
  }
  failures.push(...evaluateKnightMotionEvidence(run.scenario, run.temporal));
  if (run.repeat.passed !== true || run.repeat.firstDifference !== null)
    failures.push(`repeat diverged: ${run.repeat.firstDifference}`);
  return failures;
}

function assertMatchingShape(value: unknown, reference: unknown, path: string): void {
  if (typeof reference === "object" && reference !== null) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid ${path}`);
    const record = value as Record<string, unknown>;
    const expected = reference as Record<string, unknown>;
    if (Object.keys(record).length !== Object.keys(expected).length)
      throw new Error(`Missing or unknown fields in ${path}`);
    for (const key of Object.keys(expected)) assertMatchingShape(record[key], expected[key], `${path}.${key}`);
    return;
  }
  if (typeof value !== typeof reference || (typeof value === "number" && !Number.isFinite(value)))
    throw new Error(`Invalid ${path}`);
}

function firstValueDifference(left: unknown, right: unknown, path = "config"): string | null {
  if (typeof left === "number" && typeof right === "number") {
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-6 ? null : path;
  }
  if (left === right) return null;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return path;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const key of keys) {
    const difference = firstValueDifference(a[key], b[key], `${path}.${key}`);
    if (difference) return difference;
  }
  return null;
}

function collectChangedValues(left: unknown, right: unknown, path = "config"): string[] {
  if (!firstValueDifference(left, right)) return [];
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return [`${path}: ${String(left)} → ${String(right)}`];
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .flatMap((key) => collectChangedValues(a[key], b[key], `${path}.${key}`));
}

function hasDifferentKnightAnimationFixture(
  scenario: KnightAnimationScenario,
  reference: KnightAnimationScenario,
): boolean {
  const fixed = reference.config;
  const candidate = scenario.config;
  return (
    scenario.schemaVersion !== 1 ||
    scenario.id !== reference.id ||
    candidate.kind !== fixed.kind ||
    candidate.humanoid.appearanceId !== fixed.humanoid.appearanceId ||
    candidate.humanoid.tier !== fixed.humanoid.tier ||
    candidate.humanoid.animationMode !== fixed.humanoid.animationMode ||
    candidate.humanoid.fixedStep !== fixed.humanoid.fixedStep ||
    candidate.humanoid.seed !== fixed.humanoid.seed ||
    candidate.humanoid.autoRotate ||
    candidate.melee.autoAttack ||
    candidate.archer.autoFire ||
    candidate.melee.weaponId !== fixed.melee.weaponId ||
    candidate.melee.offhandId !== fixed.melee.offhandId ||
    scenario.rootMotionSpeed !== reference.rootMotionSpeed
  );
}

function reviewCaptureConditions(capture: ProceduralAnimationCaptureResult) {
  const { fixedStepSeconds, sequence, rootMotionSpeed, views, sampling, overlay, phases } = capture.plan;
  return { fixedStepSeconds, sequence, rootMotionSpeed, views, sampling, overlay, phases: phases.map(({ id }) => id) };
}

function evaluateKnightMotionEvidence(
  scenario: KnightAnimationScenario,
  temporal: ProceduralAnimationCaptureResult,
): string[] {
  const evaluation = evaluateProceduralAnimationCapture(temporal);
  if (resolveKnightReviewSequence(scenario.id) === "locomotion-cycle") {
    return evaluation.locomotionHardGatePassed === true ? [] : ["moving-root gait gate missing or failed"];
  }
  return evaluation.stationaryHardGatePassed === true
    ? []
    : ["stationary motion gate missing or failed", ...evaluation.stationaryHardGateFailures];
}
