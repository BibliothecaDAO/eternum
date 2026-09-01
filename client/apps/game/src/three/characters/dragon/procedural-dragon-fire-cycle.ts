import type { ProceduralDragonConfig } from "./procedural-dragon-config";

const FIRE_PHASES = ["idle", "acquire", "inhale", "fire", "recover"] as const;

export type ProceduralDragonFirePhase = (typeof FIRE_PHASES)[number];

export interface ProceduralDragonFireState {
  generation: number;
  phase: ProceduralDragonFirePhase;
  phaseElapsedSeconds: number;
  releaseCount: number;
}

export interface ProceduralDragonFireSignals {
  breath: number;
  inhale: number;
  jawOpen: number;
  neckWeight: number;
  stateProgress: number;
}

export type ProceduralDragonFireEvent =
  | { generation: number; type: "release" }
  | { generation: number; type: "recovered" };

export function createIdleProceduralDragonFireState(): ProceduralDragonFireState {
  return { generation: 0, phase: "idle", phaseElapsedSeconds: 0, releaseCount: 0 };
}

export function startProceduralDragonFire(state: ProceduralDragonFireState): ProceduralDragonFireState {
  if (state.phase !== "idle") return state;
  return { ...state, generation: state.generation + 1, phase: "acquire", phaseElapsedSeconds: 0 };
}

export function cancelProceduralDragonFire(state: ProceduralDragonFireState): ProceduralDragonFireState {
  if (state.phase === "idle" || state.phase === "recover") return state;
  return { ...state, phase: "recover", phaseElapsedSeconds: 0 };
}

export function advanceProceduralDragonFire(
  state: ProceduralDragonFireState,
  config: ProceduralDragonConfig,
  deltaSeconds: number,
  allowAutoFire = config.autoFire,
): { events: ProceduralDragonFireEvent[]; state: ProceduralDragonFireState } {
  let next = state;
  let remaining = normalizeDelta(deltaSeconds);
  const events: ProceduralDragonFireEvent[] = [];
  if (next.phase === "idle" && allowAutoFire) next = startProceduralDragonFire(next);

  for (let transition = 0; transition < FIRE_PHASES.length * 2 && next.phase !== "idle"; transition += 1) {
    const available = Math.max(0, resolvePhaseDuration(next.phase, config) - next.phaseElapsedSeconds);
    if (remaining < available) {
      next = { ...next, phaseElapsedSeconds: next.phaseElapsedSeconds + remaining };
      break;
    }
    remaining -= available;
    const advanced = enterNextPhase(next);
    next = advanced.state;
    if (advanced.event) events.push(advanced.event);
    if (next.phase === "idle" && allowAutoFire && remaining > 0) next = startProceduralDragonFire(next);
  }
  return { events, state: next };
}

export function resolveProceduralDragonFireSignals(
  state: ProceduralDragonFireState,
  config: ProceduralDragonConfig,
): ProceduralDragonFireSignals {
  const stateProgress = resolveStateProgress(state, config);
  const active = state.phase !== "idle";
  const inhale = state.phase === "inhale" ? smoothstep(stateProgress) : state.phase === "fire" ? 1 : 0;
  const breath = state.phase === "fire" ? Math.sin(Math.PI * stateProgress) ** 0.35 : 0;
  const jawOpen = state.phase === "recover" ? 1 - smoothstep(stateProgress) : active ? Math.max(inhale, 0.3) : 0;
  const neckWeight =
    state.phase === "acquire"
      ? smoothstep(stateProgress)
      : state.phase === "recover"
        ? 1 - smoothstep(stateProgress)
        : Number(active);
  return { breath, inhale, jawOpen, neckWeight, stateProgress };
}

function enterNextPhase(state: ProceduralDragonFireState): {
  event?: ProceduralDragonFireEvent;
  state: ProceduralDragonFireState;
} {
  const phase = FIRE_PHASES[(FIRE_PHASES.indexOf(state.phase) + 1) % FIRE_PHASES.length];
  const next = { ...state, phase, phaseElapsedSeconds: 0 };
  if (phase === "fire") {
    return {
      event: { generation: state.generation, type: "release" },
      state: { ...next, releaseCount: state.releaseCount + 1 },
    };
  }
  if (phase === "idle") return { event: { generation: state.generation, type: "recovered" }, state: next };
  return { state: next };
}

function resolvePhaseDuration(phase: ProceduralDragonFirePhase, config: ProceduralDragonConfig): number {
  if (phase === "idle") return Number.POSITIVE_INFINITY;
  if (phase === "acquire") return config.acquireSeconds;
  if (phase === "inhale") return config.inhaleSeconds;
  if (phase === "fire") return config.fireSeconds;
  return config.recoverSeconds;
}

function resolveStateProgress(state: ProceduralDragonFireState, config: ProceduralDragonConfig): number {
  if (state.phase === "idle") return 0;
  return Math.min(1, state.phaseElapsedSeconds / resolvePhaseDuration(state.phase, config));
}

function normalizeDelta(value: number): number {
  return Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
