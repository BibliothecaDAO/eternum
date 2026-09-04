import type { ProceduralMeleeConfig } from "./procedural-melee-config";

const MELEE_ATTACK_PHASES = ["idle", "acquire", "windup", "strike", "contact", "followThrough", "recover"] as const;

export type ProceduralMeleeAttackPhase = (typeof MELEE_ATTACK_PHASES)[number];

export interface ProceduralMeleeAttackState {
  attackGeneration: number;
  contactCount: number;
  phase: ProceduralMeleeAttackPhase;
  phaseElapsedSeconds: number;
}

export type ProceduralMeleeAttackEvent =
  | { attackGeneration: number; type: "contact" }
  | { attackGeneration: number; type: "recovered" };

export interface ProceduralMeleeAttackSignals {
  actionWeight: number;
  contactProgress: number;
  followThrough: number;
  stateProgress: number;
  strikeProgress: number;
  windupProgress: number;
}

const MAX_TRANSITIONS_PER_STEP = MELEE_ATTACK_PHASES.length * 2;

export function createIdleProceduralMeleeAttackState(): ProceduralMeleeAttackState {
  return { attackGeneration: 0, contactCount: 0, phase: "idle", phaseElapsedSeconds: 0 };
}

export function startProceduralMeleeAttack(state: ProceduralMeleeAttackState): ProceduralMeleeAttackState {
  if (state.phase !== "idle") return state;
  return {
    ...state,
    attackGeneration: state.attackGeneration + 1,
    phase: "acquire",
    phaseElapsedSeconds: 0,
  };
}

export function cancelProceduralMeleeAttack(state: ProceduralMeleeAttackState): ProceduralMeleeAttackState {
  if (state.phase === "idle" || state.phase === "recover") return state;
  return { ...state, phase: "recover", phaseElapsedSeconds: 0 };
}

export function advanceProceduralMeleeAttack(
  state: ProceduralMeleeAttackState,
  config: ProceduralMeleeConfig,
  deltaSeconds: number,
  allowAutoAttack = config.autoAttack,
): { events: ProceduralMeleeAttackEvent[]; state: ProceduralMeleeAttackState } {
  let next = state;
  let remaining = resolveDeltaSeconds(deltaSeconds);
  const events: ProceduralMeleeAttackEvent[] = [];
  if (next.phase === "idle" && allowAutoAttack) next = startProceduralMeleeAttack(next);

  for (let transition = 0; transition < MAX_TRANSITIONS_PER_STEP && next.phase !== "idle"; transition += 1) {
    const duration = resolvePhaseDuration(next.phase, config);
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
    if (next.phase === "idle" && allowAutoAttack && remaining > 0) next = startProceduralMeleeAttack(next);
  }

  return { events, state: next };
}

export function resolveProceduralMeleeAttackSignals(
  state: ProceduralMeleeAttackState,
  config: ProceduralMeleeConfig,
): ProceduralMeleeAttackSignals {
  const progress = resolveStateProgress(state, config);
  const phaseIndex = MELEE_ATTACK_PHASES.indexOf(state.phase);
  const strikeIndex = MELEE_ATTACK_PHASES.indexOf("strike");
  const contactIndex = MELEE_ATTACK_PHASES.indexOf("contact");
  return {
    actionWeight:
      state.phase === "idle"
        ? 0
        : state.phase === "acquire"
          ? smoothstep(progress)
          : state.phase === "recover"
            ? 1 - smoothstep(progress)
            : 1,
    contactProgress: state.phase === "contact" ? smoothstep(progress) : phaseIndex > contactIndex ? 1 : 0,
    followThrough: state.phase === "followThrough" ? smoothstep(progress) : phaseIndex > contactIndex ? 1 : 0,
    stateProgress: progress,
    strikeProgress: state.phase === "strike" ? smoothstep(progress) : phaseIndex > strikeIndex ? 1 : 0,
    windupProgress: state.phase === "windup" ? smoothstep(progress) : phaseIndex > 2 ? 1 : 0,
  };
}

function resolvePhaseDuration(phase: ProceduralMeleeAttackPhase, config: ProceduralMeleeConfig): number {
  if (phase === "idle") return Number.POSITIVE_INFINITY;
  if (phase === "acquire") return config.acquireSeconds;
  if (phase === "windup") return config.windupSeconds;
  if (phase === "strike") return config.strikeSeconds;
  if (phase === "contact") return config.contactSeconds;
  if (phase === "followThrough") return config.followThroughSeconds;
  return config.recoverSeconds;
}

function enterNextPhase(state: ProceduralMeleeAttackState): {
  event?: ProceduralMeleeAttackEvent;
  state: ProceduralMeleeAttackState;
} {
  const index = MELEE_ATTACK_PHASES.indexOf(state.phase);
  const phase = MELEE_ATTACK_PHASES[(index + 1) % MELEE_ATTACK_PHASES.length];
  const next = { ...state, phase, phaseElapsedSeconds: 0 };
  if (phase === "contact") {
    return {
      event: { attackGeneration: state.attackGeneration, type: "contact" },
      state: { ...next, contactCount: state.contactCount + 1 },
    };
  }
  if (phase === "idle") return { event: { attackGeneration: state.attackGeneration, type: "recovered" }, state: next };
  return { state: next };
}

function resolveStateProgress(state: ProceduralMeleeAttackState, config: ProceduralMeleeConfig): number {
  if (state.phase === "idle") return 0;
  return Math.min(1, state.phaseElapsedSeconds / resolvePhaseDuration(state.phase, config));
}

function resolveDeltaSeconds(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(0, value), 5) : 0;
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
