import type { ProceduralArcherConfig } from "./procedural-archer-config";

const PROCEDURAL_ARCHER_SHOT_PHASES = [
  "idle",
  "track",
  "nock",
  "raise",
  "draw",
  "anchor",
  "aim",
  "release",
  "followThrough",
  "recover",
] as const;

export type ProceduralArcherShotPhase = (typeof PROCEDURAL_ARCHER_SHOT_PHASES)[number];

export interface ProceduralArcherShotState {
  phase: ProceduralArcherShotPhase;
  phaseElapsedSeconds: number;
  releaseCount: number;
  shotGeneration: number;
}

export type ProceduralArcherShotEvent =
  | { type: "release"; shotGeneration: number }
  | { type: "recovered"; shotGeneration: number };

export interface ProceduralArcherShotSignals {
  actionWeight: number;
  drawFraction: number;
  drawHandFraction: number;
  followThrough: number;
  previewArrowVisible: boolean;
  raiseFraction: number;
  releaseProgress: number;
  stateProgress: number;
}

const ACTIVE_PHASES = PROCEDURAL_ARCHER_SHOT_PHASES.filter((phase) => phase !== "idle");
const MAX_TRANSITIONS_PER_STEP = ACTIVE_PHASES.length * 2;

export function createIdleProceduralArcherShotState(): ProceduralArcherShotState {
  return { phase: "idle", phaseElapsedSeconds: 0, releaseCount: 0, shotGeneration: 0 };
}

export function startProceduralArcherShot(state: ProceduralArcherShotState): ProceduralArcherShotState {
  if (state.phase !== "idle") return state;
  return {
    ...state,
    phase: "track",
    phaseElapsedSeconds: 0,
    shotGeneration: state.shotGeneration + 1,
  };
}

export function cancelProceduralArcherShot(state: ProceduralArcherShotState): ProceduralArcherShotState {
  if (state.phase === "idle" || state.phase === "recover") return state;
  return { ...state, phase: "recover", phaseElapsedSeconds: 0 };
}

export function advanceProceduralArcherShot(
  state: ProceduralArcherShotState,
  config: ProceduralArcherConfig,
  deltaSeconds: number,
  allowAutoFire = config.autoFire,
): { state: ProceduralArcherShotState; events: ProceduralArcherShotEvent[] } {
  let next = state;
  let remaining = resolveDeltaSeconds(deltaSeconds);
  const events: ProceduralArcherShotEvent[] = [];

  if (next.phase === "idle" && allowAutoFire) next = startProceduralArcherShot(next);
  for (let transition = 0; transition < MAX_TRANSITIONS_PER_STEP && next.phase !== "idle"; transition += 1) {
    const duration = resolveProceduralArcherPhaseDuration(next.phase, config);
    const available = Math.max(0, duration - next.phaseElapsedSeconds);
    if (remaining < available) {
      next = { ...next, phaseElapsedSeconds: next.phaseElapsedSeconds + remaining };
      remaining = 0;
      break;
    }

    remaining -= available;
    const advanced = enterNextPhase(next);
    next = advanced.state;
    if (advanced.event) events.push(advanced.event);
    if (next.phase === "idle" && allowAutoFire && remaining > 0) next = startProceduralArcherShot(next);
  }

  return { state: next, events };
}

export function resolveProceduralArcherShotSignals(
  state: ProceduralArcherShotState,
  config: ProceduralArcherConfig,
): ProceduralArcherShotSignals {
  const stateProgress = resolveStateProgress(state, config);
  const phaseIndex = PROCEDURAL_ARCHER_SHOT_PHASES.indexOf(state.phase);
  const raiseIndex = PROCEDURAL_ARCHER_SHOT_PHASES.indexOf("raise");
  const drawIndex = PROCEDURAL_ARCHER_SHOT_PHASES.indexOf("draw");
  const releaseIndex = PROCEDURAL_ARCHER_SHOT_PHASES.indexOf("release");
  const followThroughIndex = PROCEDURAL_ARCHER_SHOT_PHASES.indexOf("followThrough");

  const actionWeight =
    state.phase === "idle"
      ? 0
      : state.phase === "track"
        ? smoothstep(stateProgress)
        : state.phase === "recover"
          ? 1 - smoothstep(stateProgress)
          : 1;
  const raiseFraction =
    phaseIndex < raiseIndex
      ? 0
      : state.phase === "raise"
        ? smoothstep(stateProgress)
        : state.phase === "recover"
          ? 1 - smoothstep(stateProgress)
          : 1;
  const drawFraction =
    phaseIndex < drawIndex
      ? 0
      : state.phase === "draw"
        ? smoothstep(stateProgress)
        : state.phase === "release"
          ? 1 - smoothstep(stateProgress)
          : phaseIndex > releaseIndex
            ? 0
            : 1;
  const drawHandFraction =
    phaseIndex < drawIndex
      ? 0
      : state.phase === "draw"
        ? smoothstep(stateProgress)
        : state.phase === "recover"
          ? 1 - smoothstep(stateProgress)
          : 1;
  const releaseProgress = state.phase === "release" ? smoothstep(stateProgress) : phaseIndex > releaseIndex ? 1 : 0;
  const followThrough =
    state.phase === "followThrough"
      ? Math.sin(Math.PI * smoothstep(stateProgress))
      : phaseIndex > followThroughIndex
        ? 0
        : 0;

  return {
    actionWeight,
    drawFraction,
    drawHandFraction,
    followThrough,
    previewArrowVisible: phaseIndex >= PROCEDURAL_ARCHER_SHOT_PHASES.indexOf("nock") && phaseIndex < releaseIndex,
    raiseFraction,
    releaseProgress,
    stateProgress,
  };
}

function resolveProceduralArcherPhaseDuration(
  phase: Exclude<ProceduralArcherShotPhase, "idle">,
  config: ProceduralArcherConfig,
): number;
function resolveProceduralArcherPhaseDuration(phase: ProceduralArcherShotPhase, config: ProceduralArcherConfig): number;
function resolveProceduralArcherPhaseDuration(
  phase: ProceduralArcherShotPhase,
  config: ProceduralArcherConfig,
): number {
  if (phase === "idle") return Number.POSITIVE_INFINITY;
  if (phase === "track") return config.trackSeconds;
  if (phase === "nock") return config.nockSeconds;
  if (phase === "raise") return config.raiseSeconds;
  if (phase === "draw") return config.drawSeconds;
  if (phase === "anchor") return config.anchorSeconds;
  if (phase === "aim") return config.aimSeconds;
  if (phase === "release") return config.releaseSeconds;
  if (phase === "followThrough") return config.followThroughSeconds;
  return config.recoverSeconds;
}

function enterNextPhase(state: ProceduralArcherShotState): {
  state: ProceduralArcherShotState;
  event?: ProceduralArcherShotEvent;
} {
  const phaseIndex = PROCEDURAL_ARCHER_SHOT_PHASES.indexOf(state.phase);
  const phase = PROCEDURAL_ARCHER_SHOT_PHASES[(phaseIndex + 1) % PROCEDURAL_ARCHER_SHOT_PHASES.length];
  const next = { ...state, phase, phaseElapsedSeconds: 0 };
  if (phase === "release") {
    return {
      state: { ...next, releaseCount: state.releaseCount + 1 },
      event: { type: "release", shotGeneration: state.shotGeneration },
    };
  }
  if (phase === "idle") return { state: next, event: { type: "recovered", shotGeneration: state.shotGeneration } };
  return { state: next };
}

function resolveStateProgress(state: ProceduralArcherShotState, config: ProceduralArcherConfig): number {
  if (state.phase === "idle") return 0;
  return Math.min(1, state.phaseElapsedSeconds / resolveProceduralArcherPhaseDuration(state.phase, config));
}

function resolveDeltaSeconds(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(0, value), 5) : 0;
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
