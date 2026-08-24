import type { ProceduralUnitConfig, ProceduralUnitKind } from "@/three/characters";
import type { ProceduralUnitPoseDiagnostics } from "../procedural-unit-diagnostics";
import { evaluateProceduralAnimationCapture } from "./procedural-animation-evaluation";

import {
  advanceProceduralArcherShot,
  createIdleProceduralArcherShotState,
  startProceduralArcherShot,
} from "../archer/procedural-archer-shot-cycle";
import { resolveHorseGaitCadence } from "../horse/procedural-horse-gait";
import {
  resolveProceduralCharacterCadence,
  resolveProceduralCharacterStrideLength,
} from "../procedural-character-gait";
import { resolveCharacterRig } from "../procedural-character-rig";
import {
  advanceProceduralMeleeAttack,
  createIdleProceduralMeleeAttackState,
  startProceduralMeleeAttack,
} from "../melee/procedural-melee-attack-cycle";
import {
  advanceProceduralBoatBroadside,
  createIdleProceduralBoatBroadsideState,
  startProceduralBoatBroadside,
} from "../boat/procedural-boat-broadside-cycle";

export type ProceduralAnimationCaptureSequence = "archer-shot" | "boat-broadside" | "locomotion-cycle" | "melee-attack";
export type ProceduralAnimationCaptureSampling = "all-frames" | "key-phases" | "phase-atlas";
export type ProceduralAnimationCaptureOverlay = "clean" | "diagnostic";
export type ProceduralAnimationCaptureViewId =
  | "elevated-three-quarter"
  | "front"
  | "front-three-quarter"
  | "left-grip-detail"
  | "left-profile"
  | "rear"
  | "right-grip-detail"
  | "right-profile";

export interface ProceduralAnimationCaptureView {
  azimuthDegrees: number;
  detailTarget?: "gripLeft" | "gripRight";
  distanceScale?: number;
  elevationDegrees: number;
  id: ProceduralAnimationCaptureViewId;
  label: string;
}

export interface ProceduralAnimationCapturePhase {
  endFrame: number;
  id: string;
  label: string;
  startFrame: number;
}

export interface ProceduralAnimationCaptureOptions {
  overlay?: ProceduralAnimationCaptureOverlay;
  rootMotionSpeed?: number;
  sequence?: ProceduralAnimationCaptureSequence;
}

export interface ProceduralAnimationCapturePlan {
  fixedStepSeconds: number;
  overlay: ProceduralAnimationCaptureOverlay;
  phases: readonly ProceduralAnimationCapturePhase[];
  sampleFrames: readonly number[];
  sampling: ProceduralAnimationCaptureSampling;
  sequence: ProceduralAnimationCaptureSequence;
  rootMotionSpeed: number;
  totalFrames: number;
  totalSeconds: number;
  truncated: boolean;
  views: readonly ProceduralAnimationCaptureView[];
}

export interface ProceduralAnimationViewCapture {
  id: ProceduralAnimationCaptureViewId;
  imageDataUrl: string | null;
  imageNonBlank: boolean;
  label: string;
}

export interface ProceduralAnimationFrameCapture {
  diagnostics: ProceduralUnitPoseDiagnostics;
  elapsedSeconds: number;
  expectedPhase: string;
  frameIndex: number;
  imageDataUrl: string | null;
  imageNonBlank: boolean;
  issues: readonly string[];
  runtimePhase: string;
  views: readonly ProceduralAnimationViewCapture[];
}

export interface ProceduralAnimationCaptureResult {
  config: ProceduralUnitConfig;
  frames: readonly ProceduralAnimationFrameCapture[];
  plan: ProceduralAnimationCapturePlan;
}

export function createProceduralAnimationCaptureReport(result: ProceduralAnimationCaptureResult | null): unknown {
  if (!result) return null;
  return {
    config: result.config,
    evaluation: evaluateProceduralAnimationCapture(result),
    plan: result.plan,
    frames: result.frames.map(({ imageDataUrl: _imageDataUrl, views, ...frame }) => ({
      ...frame,
      views: views.map(({ imageDataUrl: _viewImageDataUrl, ...view }) => view),
    })),
  };
}

interface CapturePhaseDuration {
  durationSeconds: number;
  id: string;
  label: string;
}

const MAX_ALL_FRAME_CAPTURES = 240;
const MAX_ACTION_CAPTURE_FRAMES = 10_000;
const TIMELINE_CAPTURE_VIEW: ProceduralAnimationCaptureView = {
  azimuthDegrees: 35,
  elevationDegrees: 12,
  id: "front-three-quarter",
  label: "Front three-quarter",
};
const PHASE_ATLAS_BODY_VIEWS: readonly ProceduralAnimationCaptureView[] = [
  { azimuthDegrees: 0, elevationDegrees: 7, id: "front", label: "Front" },
  { azimuthDegrees: 90, elevationDegrees: 7, id: "right-profile", label: "Right profile" },
  { azimuthDegrees: 180, elevationDegrees: 7, id: "rear", label: "Rear" },
  { azimuthDegrees: 270, elevationDegrees: 7, id: "left-profile", label: "Left profile" },
  {
    azimuthDegrees: 35,
    elevationDegrees: 28,
    id: "elevated-three-quarter",
    label: "Elevated three-quarter",
  },
];
const PHASE_ATLAS_GRIP_VIEWS: readonly ProceduralAnimationCaptureView[] = [
  {
    azimuthDegrees: 315,
    detailTarget: "gripRight",
    distanceScale: 0.12,
    elevationDegrees: 16,
    id: "right-grip-detail",
    label: "Right grip detail",
  },
  {
    azimuthDegrees: 90,
    detailTarget: "gripLeft",
    distanceScale: 0.12,
    elevationDegrees: 16,
    id: "left-grip-detail",
    label: "Left grip detail",
  },
];

export function resolveDefaultAnimationCaptureSequence(kind: ProceduralUnitKind): ProceduralAnimationCaptureSequence {
  if (kind === "archer") return "archer-shot";
  if (kind === "boat") return "boat-broadside";
  if (kind === "knight" || kind === "paladin") return "melee-attack";
  return "locomotion-cycle";
}

function resolveDefaultAnimationCaptureOverlay(
  sampling: ProceduralAnimationCaptureSampling,
): ProceduralAnimationCaptureOverlay {
  return sampling === "phase-atlas" ? "diagnostic" : "clean";
}

export function createProceduralAnimationCapturePlan(
  config: ProceduralUnitConfig,
  sampling: ProceduralAnimationCaptureSampling,
  options: ProceduralAnimationCaptureOptions = {},
): ProceduralAnimationCapturePlan {
  const sequence = options.sequence ?? resolveDefaultAnimationCaptureSequence(config.kind);
  const overlay = options.overlay ?? resolveDefaultAnimationCaptureOverlay(sampling);
  const rootMotionSpeed = resolveCaptureRootMotionSpeed(config, sequence, options.rootMotionSpeed);
  const fixedStepSeconds = config.humanoid.fixedStep;
  const durations = resolveCapturePhaseDurations(config, sequence, rootMotionSpeed);
  const totalSeconds = durations.reduce((sum, phase) => sum + phase.durationSeconds, 0);
  const actionPhases = resolveActionCapturePhases(config, sequence, fixedStepSeconds);
  const totalFrames = actionPhases?.at(-1)?.endFrame ?? Math.max(2, Math.floor(totalSeconds / fixedStepSeconds) + 1);
  const phases = actionPhases ?? resolveCapturePhases(durations, fixedStepSeconds, totalFrames);
  const { frames: sampleFrames, truncated } = resolveSampleFrames(phases, totalFrames, sampling, sequence);
  return {
    fixedStepSeconds,
    overlay,
    phases,
    rootMotionSpeed,
    sampleFrames,
    sampling,
    sequence,
    totalFrames,
    totalSeconds,
    truncated,
    views:
      sampling === "phase-atlas"
        ? config.kind === "horse" || config.kind === "boat"
          ? PHASE_ATLAS_BODY_VIEWS
          : [...PHASE_ATLAS_BODY_VIEWS, ...PHASE_ATLAS_GRIP_VIEWS]
        : [TIMELINE_CAPTURE_VIEW],
  };
}

function resolveActionCapturePhases(
  config: ProceduralUnitConfig,
  sequence: ProceduralAnimationCaptureSequence,
  fixedStepSeconds: number,
): ProceduralAnimationCapturePhase[] | undefined {
  if (sequence === "archer-shot") {
    return traceActionCapturePhases(
      startProceduralArcherShot(createIdleProceduralArcherShotState()),
      (state) => advanceProceduralArcherShot(state, config.archer, fixedStepSeconds, false).state,
      "Archer",
    );
  }
  if (sequence === "melee-attack") {
    return traceActionCapturePhases(
      startProceduralMeleeAttack(createIdleProceduralMeleeAttackState()),
      (state) => advanceProceduralMeleeAttack(state, config.melee, fixedStepSeconds, false).state,
      "Melee",
    );
  }
  if (sequence === "boat-broadside") {
    return traceActionCapturePhases(
      startProceduralBoatBroadside(createIdleProceduralBoatBroadsideState(), "starboard"),
      (state) => advanceProceduralBoatBroadside(state, config.boat, fixedStepSeconds).state,
      "Boat broadside",
    );
  }
  return undefined;
}

function traceActionCapturePhases<State extends { phase: string }>(
  initialState: State,
  advance: (state: State) => State,
  actionLabel: string,
): ProceduralAnimationCapturePhase[] {
  let state = initialState;
  const phases: ProceduralAnimationCapturePhase[] = [];
  let phaseStartFrame = 0;
  for (let frame = 1; frame < MAX_ACTION_CAPTURE_FRAMES; frame += 1) {
    const next = advance(state);
    if (next.phase !== state.phase) {
      phases.push({
        endFrame: frame,
        id: state.phase,
        label: formatPhaseLabel(state.phase),
        startFrame: phaseStartFrame,
      });
      if (next.phase === "idle") return phases;
      phaseStartFrame = frame;
    }
    state = next;
  }
  throw new Error(`${actionLabel} capture state machine did not recover within ${MAX_ACTION_CAPTURE_FRAMES} frames`);
}

function formatPhaseLabel(phase: string): string {
  return phase.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

export function resolveAnimationCapturePhase(
  plan: ProceduralAnimationCapturePlan,
  frameIndex: number,
): ProceduralAnimationCapturePhase | undefined {
  const clampedFrame = clampFrameIndex(frameIndex, plan.totalFrames);
  return plan.phases.find(({ endFrame, startFrame }) => clampedFrame >= startFrame && clampedFrame < endFrame);
}

export function clampFrameIndex(frameIndex: number, totalFrames: number): number {
  const finite = Number.isFinite(frameIndex) ? Math.round(frameIndex) : 0;
  return Math.min(Math.max(0, finite), Math.max(0, totalFrames - 1));
}

export function resolveAnimationFrameIssues(input: {
  diagnostics: ProceduralUnitPoseDiagnostics;
  expectedPhase: string;
  runtimePhase: string;
}): string[] {
  const issues = [...input.diagnostics.issues];
  if (input.expectedPhase !== "complete" && input.expectedPhase !== input.runtimePhase) {
    issues.push(`phase-mismatch:${input.expectedPhase}:${input.runtimePhase}`);
  }
  const validatePalms =
    input.diagnostics.kind === "archer" && (input.expectedPhase === "anchor" || input.expectedPhase === "aim");
  if (validatePalms && input.diagnostics.humanoid) {
    if (input.diagnostics.humanoid.palmInwardDot.left < -0.15) {
      issues.push("left-palm-outward");
    }
    if (input.diagnostics.humanoid.palmInwardDot.right < -0.15) issues.push("right-palm-outward");
  }
  if (
    input.diagnostics.kind === "archer" &&
    (input.expectedPhase === "anchor" || input.expectedPhase === "aim") &&
    input.diagnostics.bow?.previewArrowVisible
  ) {
    const bow = input.diagnostics.bow;
    const headRadius = input.diagnostics.humanoid?.headRadius ?? 0;
    if (bow.arrowHeadClearance < -0.01) issues.push("arrow-intersects-head");
    if (bow.bowGripHeadDistance < headRadius * 1.9) issues.push("bow-grip-too-close-to-head");
    if (bow.nockJawDistance !== null && bow.nockJawDistance > headRadius * 2.2) {
      issues.push("draw-anchor-too-far-from-face");
    }
  }
  return [...new Set(issues)];
}

function resolveCapturePhaseDurations(
  config: ProceduralUnitConfig,
  sequence: ProceduralAnimationCaptureSequence,
  rootMotionSpeed: number,
): CapturePhaseDuration[] {
  if (sequence === "archer-shot") {
    return [
      phase("track", "Track", config.archer.trackSeconds),
      phase("nock", "Nock", config.archer.nockSeconds),
      phase("raise", "Raise", config.archer.raiseSeconds),
      phase("draw", "Draw", config.archer.drawSeconds),
      phase("anchor", "Anchor", config.archer.anchorSeconds),
      phase("aim", "Aim", config.archer.aimSeconds),
      phase("release", "Release", config.archer.releaseSeconds),
      phase("followThrough", "Follow-through", config.archer.followThroughSeconds),
      phase("recover", "Recover", config.archer.recoverSeconds),
    ];
  }
  if (sequence === "melee-attack") {
    return [
      phase("acquire", "Acquire", config.melee.acquireSeconds),
      phase("windup", "Windup", config.melee.windupSeconds),
      phase("strike", "Strike", config.melee.strikeSeconds),
      phase("contact", "Contact", config.melee.contactSeconds),
      phase("followThrough", "Follow-through", config.melee.followThroughSeconds),
      phase("recover", "Recover", config.melee.recoverSeconds),
    ];
  }
  if (sequence === "boat-broadside") {
    return [
      phase("acquire", "Acquire", config.boat.acquireSeconds),
      phase("brace", "Brace", config.boat.braceSeconds),
      phase("fire", "Fire", config.boat.fireSeconds),
      phase("recoil", "Recoil", config.boat.recoilSeconds),
      phase("recover", "Recover", config.boat.recoverSeconds),
    ];
  }

  const cadence =
    config.kind === "horse" || config.kind === "paladin"
      ? resolveHorseGaitCadence(config.horse)
      : resolveHumanoidCapturePhaseRate(config, rootMotionSpeed);
  return [phase("gait", "Gait cycle", 1 / Math.max(0.1, cadence))];
}

function resolveCaptureRootMotionSpeed(
  config: ProceduralUnitConfig,
  sequence: ProceduralAnimationCaptureSequence,
  requestedSpeed: number | undefined,
): number {
  if (
    sequence !== "locomotion-cycle" ||
    config.kind === "horse" ||
    config.kind === "paladin" ||
    (config.humanoid.animationMode !== "walk" && config.humanoid.animationMode !== "run")
  ) {
    return 0;
  }
  if (requestedSpeed !== undefined) return Number.isFinite(requestedSpeed) ? Math.max(0, requestedSpeed) : 0;
  const rig = resolveCharacterRig(config.humanoid);
  return (
    resolveProceduralCharacterCadence(config.humanoid) *
    resolveProceduralCharacterStrideLength(config.humanoid, rig.morphology.scale)
  );
}

function resolveHumanoidCapturePhaseRate(config: ProceduralUnitConfig, rootMotionSpeed: number): number {
  const cadence = resolveProceduralCharacterCadence(config.humanoid);
  if (rootMotionSpeed <= 0) return cadence;
  const rig = resolveCharacterRig(config.humanoid);
  const strideLength = resolveProceduralCharacterStrideLength(config.humanoid, rig.morphology.scale);
  const travelDrivenRate = Math.min(rootMotionSpeed / strideLength, cadence * 2.5 + 0.02 / config.humanoid.fixedStep);
  return cadence * 0.35 + travelDrivenRate * 0.65;
}

function phase(id: string, label: string, durationSeconds: number): CapturePhaseDuration {
  return { durationSeconds: Math.max(0.001, durationSeconds), id, label };
}

function resolveCapturePhases(
  durations: readonly CapturePhaseDuration[],
  fixedStepSeconds: number,
  totalFrames: number,
): ProceduralAnimationCapturePhase[] {
  let elapsedSeconds = 0;
  return durations.map((duration, index) => {
    const startFrame = Math.min(totalFrames - 1, Math.round(elapsedSeconds / fixedStepSeconds));
    elapsedSeconds += duration.durationSeconds;
    const endFrame =
      index === durations.length - 1
        ? totalFrames
        : Math.max(startFrame + 1, Math.min(totalFrames, Math.round(elapsedSeconds / fixedStepSeconds)));
    return { endFrame, id: duration.id, label: duration.label, startFrame };
  });
}

function resolveSampleFrames(
  phases: readonly ProceduralAnimationCapturePhase[],
  totalFrames: number,
  sampling: ProceduralAnimationCaptureSampling,
  sequence: ProceduralAnimationCaptureSequence,
): { frames: number[]; truncated: boolean } {
  if (sampling === "all-frames") {
    if (totalFrames <= MAX_ALL_FRAME_CAPTURES) {
      return { frames: Array.from({ length: totalFrames }, (_, frame) => frame), truncated: false };
    }
    return {
      frames: resolveEvenlySpacedFrames(totalFrames, MAX_ALL_FRAME_CAPTURES),
      truncated: true,
    };
  }

  if (sampling === "phase-atlas") {
    if (sequence === "locomotion-cycle") {
      return {
        frames: [0, 0.25, 0.5, 0.75].map((cycleProgress) =>
          clampFrameIndex(Math.floor(totalFrames * cycleProgress), totalFrames),
        ),
        truncated: false,
      };
    }
    return {
      frames: phases.map(({ endFrame, startFrame }) =>
        Math.min(totalFrames - 1, Math.floor((startFrame + endFrame - 1) / 2)),
      ),
      truncated: false,
    };
  }

  const frames = new Set<number>([0, totalFrames - 1]);
  phases.forEach(({ endFrame, startFrame }) => {
    frames.add(startFrame);
    frames.add(Math.min(totalFrames - 1, Math.floor((startFrame + endFrame - 1) / 2)));
  });
  return { frames: [...frames].toSorted((left, right) => left - right), truncated: false };
}

function resolveEvenlySpacedFrames(totalFrames: number, sampleCount: number): number[] {
  return Array.from({ length: sampleCount }, (_, index) =>
    Math.round((index / Math.max(1, sampleCount - 1)) * (totalFrames - 1)),
  ).filter((frame, index, frames) => index === 0 || frame !== frames[index - 1]);
}
