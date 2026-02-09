export interface ChunkSwitchDecisionInput {
  fetchSucceeded: boolean;
  currentChunk: string;
  targetChunk: string;
  previousChunk?: string | null;
}

export interface ChunkSwitchActions {
  shouldRollback: boolean;
  shouldCommitManagers: boolean;
  shouldUnregisterPreviousChunk: boolean;
  shouldRestorePreviousState: boolean;
}

export interface ManagerUpdateDecisionInput {
  transitionToken?: number;
  expectedTransitionToken: number;
  currentChunk: string;
  targetChunk: string;
}

/**
 * Resolve chunk-switch side effects after hydration completes.
 * Keeps behavior deterministic for success, failure, and stale transitions.
 */
export function resolveChunkSwitchActions(input: ChunkSwitchDecisionInput): ChunkSwitchActions {
  const isStillTargetChunk = input.currentChunk === input.targetChunk;

  if (!isStillTargetChunk) {
    return {
      shouldRollback: false,
      shouldCommitManagers: false,
      shouldUnregisterPreviousChunk: false,
      shouldRestorePreviousState: false,
    };
  }

  if (!input.fetchSucceeded) {
    return {
      shouldRollback: true,
      shouldCommitManagers: false,
      shouldUnregisterPreviousChunk: false,
      shouldRestorePreviousState: true,
    };
  }

  const shouldUnregisterPreviousChunk = Boolean(
    input.previousChunk && input.previousChunk !== input.targetChunk,
  );

  return {
    shouldRollback: false,
    shouldCommitManagers: true,
    shouldUnregisterPreviousChunk,
    shouldRestorePreviousState: false,
  };
}

/**
 * Manager updates should only apply when the transition token is current and
 * the target chunk is still the active chunk.
 */
export function shouldRunManagerUpdate(input: ManagerUpdateDecisionInput): boolean {
  if (!shouldAcceptTransitionToken(input.transitionToken, input.expectedTransitionToken)) {
    return false;
  }

  return input.currentChunk === input.targetChunk;
}

/**
 * Accept only current or newer transition tokens.
 * Undefined token is treated as non-transitioned work and accepted.
 */
export function shouldAcceptTransitionToken(transitionToken: number | undefined, latestTransitionToken: number): boolean {
  if (transitionToken === undefined) {
    return true;
  }
  return transitionToken >= latestTransitionToken;
}
