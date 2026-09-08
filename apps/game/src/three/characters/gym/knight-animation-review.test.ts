import { describe, expect, it } from "vitest";
import {
  createKnightAnimationScenario,
  readKnightAnimationScenario,
  firstCaptureDifference,
  resolveKnightReviewSequence,
  compareKnightAnimationRuns,
  type KnightAnimationReviewRun,
  type KnightAnimationScenario,
} from "./knight-animation-review";
import {
  createProceduralAnimationCapturePlan,
  type ProceduralAnimationCaptureResult,
} from "./procedural-animation-capture";
import { evaluateAnimationCoverage } from "./procedural-animation-evidence.mjs";

describe("knight animation review", () => {
  it("does not label a walking knight as an idle capture", () => {
    expect(() =>
      createProceduralAnimationCapturePlan(createKnightAnimationScenario().config, "all-frames", {
        sequence: "idle-hold",
      }),
    ).toThrow("idle mode");
  });
  it.each(["knight-walk", "knight-run", "knight-idle", "knight-attack"] as const)(
    "round trips %s with the correct capture sequence",
    (id) => {
      const scenario = createKnightAnimationScenario(id);
      expect(readKnightAnimationScenario(JSON.parse(JSON.stringify(scenario)))).toEqual(scenario);
      const plan = createProceduralAnimationCapturePlan(scenario.config, "all-frames", {
        sequence: resolveKnightReviewSequence(id),
        rootMotionSpeed: scenario.rootMotionSpeed,
      });
      expect(plan.truncated).toBe(false);
      if (id === "knight-idle") {
        expect(plan.sequence).toBe("idle-hold");
        expect(plan.totalFrames).toBe(121);
        expect(plan.rootMotionSpeed).toBe(0);
      } else if (id === "knight-attack") {
        expect(plan.sequence).toBe("melee-attack");
        expect(plan.phases.map(({ id }) => id)).toEqual([
          "acquire",
          "windup",
          "strike",
          "contact",
          "followThrough",
          "recover",
          "idle",
        ]);
        expect(plan.rootMotionSpeed).toBe(0);
      } else expect(plan.rootMotionSpeed).toBeGreaterThan(0);
    },
  );

  it("allows attack timing edits but rejects a different weapon or selected motion", () => {
    const scenario = createKnightAnimationScenario("knight-attack");
    scenario.config.melee.windupSeconds = 0.45;
    scenario.config.melee.torsoWeight = 0.7;
    expect(readKnightAnimationScenario(scenario)).toEqual(scenario);
    scenario.config.melee.weaponId = "runic-warhammer";
    expect(() => readKnightAnimationScenario(scenario)).toThrow();
    const run = createKnightAnimationScenario("knight-run");
    run.config.humanoid.animationMode = "walk";
    expect(() => readKnightAnimationScenario(run)).toThrow();
  });

  it("allows timing comparison without confusing different animations or passing missing evidence", () => {
    const scenario = createKnightAnimationScenario("knight-attack");
    const baseline = createReviewRunWithoutPoseEvidence(scenario);
    const changed = structuredClone(scenario);
    changed.config.melee.windupSeconds = 0.45;
    const comparison = compareKnightAnimationRuns(baseline, createReviewRunWithoutPoseEvidence(changed));
    expect(comparison.compatible).toBe(true);
    expect(comparison.timingChanged).toBe(true);
    expect(comparison.failures.length).toBeGreaterThan(0);
    const incomplete = createReviewRunWithoutPoseEvidence(changed);
    incomplete.temporal = { ...incomplete.temporal, frames: incomplete.temporal.frames.slice(1) };
    expect(compareKnightAnimationRuns(baseline, incomplete).compatible).toBe(false);
    expect(
      compareKnightAnimationRuns(
        baseline,
        createReviewRunWithoutPoseEvidence(createKnightAnimationScenario("knight-idle")),
      ).compatible,
    ).toBe(false);
    const otherRenderer = createReviewRunWithoutPoseEvidence(scenario);
    otherRenderer.environment.renderer = "webgpu";
    expect(compareKnightAnimationRuns(baseline, otherRenderer).compatible).toBe(false);
  });
  it("round trips the complete saved scenario and retains an intentional motion edit", () => {
    const scenario = createKnightAnimationScenario();
    scenario.config.humanoid.armSwing = 0.5;
    expect(readKnightAnimationScenario(JSON.parse(JSON.stringify(scenario)))).toEqual(scenario);
    expect(scenario.rootMotionSpeed).toBeGreaterThan(0);
  });

  it("rejects missing configuration, different models, invalid values and unsupported scenarios", () => {
    for (const mutate of [
      (scenario: any) => delete scenario.config.humanoid.stride,
      (scenario: any) => (scenario.config.humanoid.appearanceId = "modular-fantasy"),
      (scenario: any) => (scenario.config.humanoid.stride = -1),
      (scenario: any) => (scenario.config.humanoid.bob = NaN),
      (scenario: any) => (scenario.config.humanoid.seed = 123),
      (scenario: any) => (scenario.id = "other"),
      (scenario: any) => (scenario.config.melee.autoAttack = true),
    ]) {
      const scenario = createKnightAnimationScenario();
      mutate(scenario);
      expect(() => readKnightAnimationScenario(scenario)).toThrow();
    }
  });

  it("finds the first semantic replay divergence while ignoring image encoding", () => {
    const scenario = createKnightAnimationScenario();
    const plan = createProceduralAnimationCapturePlan(scenario.config, "all-frames", { sequence: "locomotion-cycle" });
    const result = {
      config: scenario.config,
      plan,
      frames: [
        { frameIndex: 0, runtimePhase: "gait", issues: [], diagnostics: { humanoid: { phase: 0 } }, imageDataUrl: "a" },
      ],
    } as unknown as ProceduralAnimationCaptureResult;
    const repeat = structuredClone(result);
    repeat.frames[0].imageDataUrl = "different pixels";
    expect(firstCaptureDifference(result, repeat)).toBeNull();
    repeat.frames[0].diagnostics.humanoid!.phase = 0.2;
    expect(firstCaptureDifference(result, repeat)).toBe("F0.diagnostics.humanoid.phase");
  });

  it("cannot call capped or sparse temporal evidence complete", () => {
    const report = {
      plan: {
        sampling: "all-frames",
        totalFrames: 3,
        sampleFrames: [0, 2],
        fixedStepSeconds: 1 / 60,
        views: [{ id: "front" }],
        truncated: true,
      },
      frames: [0, 2].map((frameIndex) => ({ frameIndex, elapsedSeconds: frameIndex / 60, views: [{ id: "front" }] })),
    };
    expect(evaluateAnimationCoverage(report)).toMatchObject({ complete: false, temporalCoverage: false });
    expect(evaluateAnimationCoverage({ ...report, plan: { ...report.plan, truncated: false } }).complete).toBe(false);
  });
});

function createReviewRunWithoutPoseEvidence(scenario: KnightAnimationScenario): KnightAnimationReviewRun {
  const capture = (sampling: "all-frames" | "phase-atlas"): ProceduralAnimationCaptureResult => {
    const plan = createProceduralAnimationCapturePlan(scenario.config, sampling, {
      sequence: resolveKnightReviewSequence(scenario.id),
      rootMotionSpeed: scenario.rootMotionSpeed,
    });
    return {
      config: scenario.config,
      plan,
      frames: plan.sampleFrames.map((frameIndex) => ({
        frameIndex,
        elapsedSeconds: frameIndex * plan.fixedStepSeconds,
        expectedPhase: "idle",
        runtimePhase: "idle",
        issues: [],
        imageNonBlank: true,
        imageDataUrl: null,
        diagnostics: {
          kind: "knight",
          humanoid: null,
          boat: null,
          bow: null,
          crossbow: null,
          horse: null,
          melee: null,
          issues: [],
        },
        views: plan.views.map(({ id, label }) => ({ id, label, imageDataUrl: null, imageNonBlank: true })),
      })),
    };
  };
  return {
    id: "test",
    createdAt: "test",
    scenario,
    environment: { renderer: "webgl", viewport: "100x100", assetHash: "same", userAgent: "same" },
    temporal: capture("all-frames"),
    atlas: capture("phase-atlas"),
    repeat: { passed: true, firstDifference: null },
  };
}
