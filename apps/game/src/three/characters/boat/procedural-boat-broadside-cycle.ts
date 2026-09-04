import type { ProceduralBoatConfig } from "./procedural-boat-config";

const BROADSIDE_PHASES = ["idle", "acquire", "brace", "fire", "recoil", "recover"] as const;

export type ProceduralBoatBroadsidePhase = (typeof BROADSIDE_PHASES)[number];
export type ProceduralBoatBroadsideSide = "port" | "starboard";

export interface ProceduralBoatBroadsideState {
  generation: number;
  phase: ProceduralBoatBroadsidePhase;
  phaseElapsedSeconds: number;
  releaseCount: number;
  side: ProceduralBoatBroadsideSide;
}

export type ProceduralBoatBroadsideEvent =
  | { generation: number; side: ProceduralBoatBroadsideSide; type: "release" }
  | { generation: number; type: "recovered" };

export interface ProceduralBoatBroadsideSignals {
  brace: number;
  muzzleFlash: number;
  recoil: number;
  stateProgress: number;
}

export function createIdleProceduralBoatBroadsideState(): ProceduralBoatBroadsideState {
  return { generation: 0, phase: "idle", phaseElapsedSeconds: 0, releaseCount: 0, side: "starboard" };
}

export function startProceduralBoatBroadside(
  state: ProceduralBoatBroadsideState,
  side: ProceduralBoatBroadsideSide,
): ProceduralBoatBroadsideState {
  if (state.phase !== "idle") return state;
  return {
    ...state,
    generation: state.generation + 1,
    phase: "acquire",
    phaseElapsedSeconds: 0,
    side,
  };
}

export function cancelProceduralBoatBroadside(state: ProceduralBoatBroadsideState): ProceduralBoatBroadsideState {
  if (state.phase === "idle" || state.phase === "recover") return state;
  return { ...state, phase: "recover", phaseElapsedSeconds: 0 };
}

export function advanceProceduralBoatBroadside(
  state: ProceduralBoatBroadsideState,
  config: ProceduralBoatConfig,
  deltaSeconds: number,
  autoFireSide?: ProceduralBoatBroadsideSide,
): { events: ProceduralBoatBroadsideEvent[]; state: ProceduralBoatBroadsideState } {
  let next = state;
  let remaining = normalizeDeltaSeconds(deltaSeconds);
  const events: ProceduralBoatBroadsideEvent[] = [];
  if (next.phase === "idle" && config.autoFire && autoFireSide) {
    next = startProceduralBoatBroadside(next, autoFireSide);
  }

  for (let transition = 0; transition < BROADSIDE_PHASES.length * 2 && next.phase !== "idle"; transition += 1) {
    const available = Math.max(0, resolveBroadsidePhaseDuration(next.phase, config) - next.phaseElapsedSeconds);
    if (remaining < available) {
      next = { ...next, phaseElapsedSeconds: next.phaseElapsedSeconds + remaining };
      break;
    }
    remaining -= available;
    const advanced = enterNextBroadsidePhase(next);
    next = advanced.state;
    if (advanced.event) events.push(advanced.event);
    if (next.phase === "idle" && config.autoFire && autoFireSide && remaining > 0) {
      next = startProceduralBoatBroadside(next, autoFireSide);
    }
  }
  return { events, state: next };
}

export function resolveProceduralBoatBroadsideSignals(
  state: ProceduralBoatBroadsideState,
  config: ProceduralBoatConfig,
): ProceduralBoatBroadsideSignals {
  const stateProgress = resolveStateProgress(state, config);
  const phaseIndex = BROADSIDE_PHASES.indexOf(state.phase);
  const braceIndex = BROADSIDE_PHASES.indexOf("brace");
  const recoverIndex = BROADSIDE_PHASES.indexOf("recover");
  const brace =
    phaseIndex < braceIndex
      ? 0
      : state.phase === "brace"
        ? smoothstep(stateProgress)
        : state.phase === "recover"
          ? 1 - smoothstep(stateProgress)
          : phaseIndex < recoverIndex
            ? 1
            : 0;
  return {
    brace,
    muzzleFlash: state.phase === "fire" ? Math.sin(Math.PI * stateProgress) : 0,
    recoil: state.phase === "recoil" ? 1 - smoothstep(stateProgress) : 0,
    stateProgress,
  };
}

function enterNextBroadsidePhase(state: ProceduralBoatBroadsideState): {
  event?: ProceduralBoatBroadsideEvent;
  state: ProceduralBoatBroadsideState;
} {
  const phaseIndex = BROADSIDE_PHASES.indexOf(state.phase);
  const phase = BROADSIDE_PHASES[(phaseIndex + 1) % BROADSIDE_PHASES.length];
  const next = { ...state, phase, phaseElapsedSeconds: 0 };
  if (phase === "fire") {
    return {
      event: { generation: state.generation, side: state.side, type: "release" },
      state: { ...next, releaseCount: state.releaseCount + 1 },
    };
  }
  if (phase === "idle") return { event: { generation: state.generation, type: "recovered" }, state: next };
  return { state: next };
}

function resolveBroadsidePhaseDuration(
  phase: Exclude<ProceduralBoatBroadsidePhase, "idle">,
  config: ProceduralBoatConfig,
): number;
function resolveBroadsidePhaseDuration(phase: ProceduralBoatBroadsidePhase, config: ProceduralBoatConfig): number;
function resolveBroadsidePhaseDuration(phase: ProceduralBoatBroadsidePhase, config: ProceduralBoatConfig): number {
  if (phase === "idle") return Number.POSITIVE_INFINITY;
  if (phase === "acquire") return config.acquireSeconds;
  if (phase === "brace") return config.braceSeconds;
  if (phase === "fire") return config.fireSeconds;
  if (phase === "recoil") return config.recoilSeconds;
  return config.recoverSeconds;
}

function resolveStateProgress(state: ProceduralBoatBroadsideState, config: ProceduralBoatConfig): number {
  if (state.phase === "idle") return 0;
  return Math.min(1, state.phaseElapsedSeconds / resolveBroadsidePhaseDuration(state.phase, config));
}

function normalizeDeltaSeconds(value: number): number {
  return Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
