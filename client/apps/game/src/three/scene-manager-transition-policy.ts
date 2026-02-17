import { SceneName } from "./types";

export interface SceneSwitchRequestInput {
  requestedSceneName: SceneName;
  hasRequestedScene: boolean;
  transitionRequestToken: number;
  transitionInProgress: boolean;
  pendingSceneName: SceneName | undefined;
}

export interface SceneSwitchRequestDecision {
  shouldStartPendingTransition: boolean;
  nextTransitionRequestToken: number;
  nextPendingSceneName: SceneName | undefined;
}

export interface PendingTransitionStartInput {
  pendingSceneName: SceneName | undefined;
  hasPendingScene: boolean;
  transitionRequestToken: number;
}

export interface PendingTransitionStartDecision {
  shouldStartTransition: boolean;
  sceneNameToTransition: SceneName | undefined;
  transitionToken: number | undefined;
  nextPendingSceneName: SceneName | undefined;
}

export interface TransitionFinalizePlanInput {
  transitionToken: number;
  latestTransitionRequestToken: number;
  hasPendingScene: boolean;
}

export interface TransitionFinalizePlan {
  isSuperseded: boolean;
  shouldRunPostSetupEffects: boolean;
  shouldStartPendingTransition: boolean;
}

export const resolveSceneSwitchRequest = (input: SceneSwitchRequestInput): SceneSwitchRequestDecision => {
  if (!input.hasRequestedScene) {
    return {
      shouldStartPendingTransition: false,
      nextTransitionRequestToken: input.transitionRequestToken,
      nextPendingSceneName: input.pendingSceneName,
    };
  }

  const nextTransitionRequestToken = input.transitionRequestToken + 1;
  return {
    shouldStartPendingTransition: !input.transitionInProgress,
    nextTransitionRequestToken,
    nextPendingSceneName: input.requestedSceneName,
  };
};

export const resolvePendingTransitionStart = (
  input: PendingTransitionStartInput,
): PendingTransitionStartDecision => {
  if (!input.pendingSceneName) {
    return {
      shouldStartTransition: false,
      sceneNameToTransition: undefined,
      transitionToken: undefined,
      nextPendingSceneName: undefined,
    };
  }

  if (!input.hasPendingScene) {
    return {
      shouldStartTransition: false,
      sceneNameToTransition: undefined,
      transitionToken: undefined,
      nextPendingSceneName: undefined,
    };
  }

  return {
    shouldStartTransition: true,
    sceneNameToTransition: input.pendingSceneName,
    transitionToken: input.transitionRequestToken,
    nextPendingSceneName: undefined,
  };
};

export const resolveTransitionFinalizePlan = (
  input: TransitionFinalizePlanInput,
): TransitionFinalizePlan => {
  const isSuperseded = input.transitionToken !== input.latestTransitionRequestToken;

  return {
    isSuperseded,
    shouldRunPostSetupEffects: !isSuperseded,
    shouldStartPendingTransition: input.hasPendingScene,
  };
};
