interface ChunkSwitchDecisionInput {
  fetchSucceeded: boolean;
  isCurrentTransition: boolean;
  targetChunk: string;
  previousChunk?: string | null;
}

interface ChunkSwitchActions {
  shouldRollback: boolean;
  shouldCommitManagers: boolean;
  shouldUnregisterPreviousChunk: boolean;
  shouldRestorePreviousState: boolean;
}

interface ManagerUpdateDecisionInput {
  transitionToken?: number;
  expectedTransitionToken: number;
  currentChunk: string;
  targetChunk: string;
}

interface ShortcutNavigationRefreshDecisionInput {
  isShortcutNavigation: boolean;
  transitionDurationSeconds: number;
  chunkChanged: boolean;
}

interface ShortcutForceFallbackDecisionInput {
  isShortcutNavigation: boolean;
  chunkChanged: boolean;
  initialSwitchSucceeded: boolean;
}

/**
 * Resolve chunk-switch side effects after hydration completes.
 * Keeps behavior deterministic for success, failure, and stale transitions.
 */
export function resolveChunkSwitchActions(input: ChunkSwitchDecisionInput): ChunkSwitchActions {
  if (!input.isCurrentTransition) {
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

  const shouldUnregisterPreviousChunk = Boolean(input.previousChunk && input.previousChunk !== input.targetChunk);

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
  if (!shouldAcceptExactTransitionToken(input.transitionToken, input.expectedTransitionToken)) {
    return false;
  }

  return input.currentChunk === input.targetChunk;
}

/**
 * Accept transition tokens in monotonic order.
 * Undefined token is treated as non-transitioned work and accepted.
 */
export function shouldAcceptTransitionToken(
  transitionToken: number | undefined,
  latestTransitionToken: number,
): boolean {
  if (transitionToken === undefined) {
    return true;
  }
  return transitionToken >= latestTransitionToken;
}

/**
 * Accept only the exact current transition token.
 * Undefined token is treated as non-transitioned work and accepted.
 */
export function shouldAcceptExactTransitionToken(
  transitionToken: number | undefined,
  latestTransitionToken: number,
): boolean {
  if (transitionToken === undefined) {
    return true;
  }
  return transitionToken === latestTransitionToken;
}

/**
 * Refresh updates should only apply for the latest scheduled token.
 * This enforces latest-wins behavior for debounced camera refresh work.
 */
export function shouldApplyRefreshToken(scheduledToken: number, latestToken: number): boolean {
  return scheduledToken === latestToken;
}

/**
 * When a scheduled refresh token is older than the latest token,
 * the refresh should be rescheduled to converge on the newest camera state.
 */
export function shouldRescheduleRefreshToken(scheduledToken: number, latestToken: number): boolean {
  return scheduledToken < latestToken;
}

/**
 * Convert a scheduled refresh token into an execution token.
 * Stale scheduled work should execute using the latest token to avoid starvation.
 */
export function resolveRefreshExecutionToken(scheduledToken: number, latestToken: number): number {
  return scheduledToken < latestToken ? latestToken : scheduledToken;
}

/**
 * Instant camera teleports triggered by shortcut navigation should force
 * a chunk refresh so switch hysteresis cannot suppress reconciliation.
 */
export function shouldForceShortcutNavigationRefresh(input: ShortcutNavigationRefreshDecisionInput): boolean {
  return input.chunkChanged && input.isShortcutNavigation && input.transitionDurationSeconds <= 0;
}

/**
 * After a shortcut navigation refresh attempt, run a forced fallback pass
 * if the initial attempt did not switch to the target chunk.
 */
export function shouldRunShortcutForceFallback(input: ShortcutForceFallbackDecisionInput): boolean {
  return input.isShortcutNavigation && input.chunkChanged && !input.initialSwitchSucceeded;
}

/**
 * Wait for any in-flight chunk transition promise to settle.
 * Re-checks after each await so callers handle promise replacement races.
 */
export async function waitForChunkTransitionToSettle(
  getTransitionPromise: () => Promise<unknown> | null,
  onTransitionError?: (error: unknown) => void,
): Promise<void> {
  while (true) {
    const transitionPromise = getTransitionPromise();
    if (!transitionPromise) {
      return;
    }

    try {
      await transitionPromise;
    } catch (error) {
      onTransitionError?.(error);
    }
  }
}
