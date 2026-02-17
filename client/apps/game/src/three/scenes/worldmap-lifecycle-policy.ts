export type WorldmapLifecyclePhase = "setup" | "switchOff" | "destroy";

export interface UrlChangedListenerLifecycleInput {
  phase: WorldmapLifecyclePhase;
  isUrlChangedListenerAttached: boolean;
}

export interface UrlChangedListenerLifecycleDecision {
  shouldAttach: boolean;
  shouldDetach: boolean;
  nextIsUrlChangedListenerAttached: boolean;
}

export const resolveUrlChangedListenerLifecycle = (
  input: UrlChangedListenerLifecycleInput,
): UrlChangedListenerLifecycleDecision => {
  if (input.phase === "setup") {
    return {
      shouldAttach: !input.isUrlChangedListenerAttached,
      shouldDetach: false,
      nextIsUrlChangedListenerAttached: true,
    };
  }

  return {
    shouldAttach: false,
    shouldDetach: input.isUrlChangedListenerAttached,
    nextIsUrlChangedListenerAttached: false,
  };
};
