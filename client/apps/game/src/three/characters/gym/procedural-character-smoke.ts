export type CharacterGymSmokePhase = "idle" | "animating" | "impact" | "settling" | "passed" | "failed";
export type CharacterGymSmokeAction = "apply-impulse" | "evaluate" | "start-ragdoll";

export interface CharacterGymSmokeState {
  phase: CharacterGymSmokePhase;
  phaseElapsed: number;
  failures: readonly string[];
}

export function createIdleCharacterGymSmokeState(): CharacterGymSmokeState {
  return { phase: "idle", phaseElapsed: 0, failures: [] };
}

export function startCharacterGymSmoke(): CharacterGymSmokeState {
  return { phase: "animating", phaseElapsed: 0, failures: [] };
}

export function advanceCharacterGymSmoke(
  state: CharacterGymSmokeState,
  deltaSeconds: number,
): { state: CharacterGymSmokeState; actions: CharacterGymSmokeAction[] } {
  if (state.phase === "idle" || state.phase === "passed" || state.phase === "failed") {
    return { state, actions: [] };
  }

  const phaseElapsed = state.phaseElapsed + Math.max(0, deltaSeconds);
  if (state.phase === "animating" && phaseElapsed >= 2.1) {
    return {
      state: { ...state, phase: "impact", phaseElapsed: 0 },
      actions: ["start-ragdoll"],
    };
  }
  if (state.phase === "impact" && phaseElapsed >= 0.12) {
    return {
      state: { ...state, phase: "settling", phaseElapsed: 0 },
      actions: ["apply-impulse"],
    };
  }
  if (state.phase === "settling" && phaseElapsed >= 3.6) {
    return {
      state: { ...state, phaseElapsed },
      actions: ["evaluate"],
    };
  }

  return { state: { ...state, phaseElapsed }, actions: [] };
}

export function completeCharacterGymSmoke(
  state: CharacterGymSmokeState,
  failures: readonly string[],
): CharacterGymSmokeState {
  return {
    phase: failures.length === 0 ? "passed" : "failed",
    phaseElapsed: state.phaseElapsed,
    failures: [...failures],
  };
}
