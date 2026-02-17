import { getRenderFetchBoundsForChunk } from "./worldmap-chunk-bounds";

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

interface DuplicateTileRefreshDecisionInput {
  removeExplored: boolean;
  tileAlreadyKnown: boolean;
  hasBiomeDelta?: boolean;
  currentChunk: string;
  isChunkTransitioning: boolean;
  isVisibleInCurrentChunk: boolean;
}

interface DuplicateTileUpdateActions {
  shouldInvalidateCaches: boolean;
  shouldRequestRefresh: boolean;
}

type DuplicateTileRefreshStrategy = "none" | "deferred" | "immediate";

interface DuplicateTileReconcilePlan {
  shouldInvalidateCaches: boolean;
  refreshStrategy: DuplicateTileRefreshStrategy;
}

type DuplicateTileUpdateMode = "none" | "invalidate_only" | "invalidate_and_refresh";

interface RefreshExecutionPlan {
  shouldApplyScheduled: boolean;
  shouldRecordSuperseded: boolean;
  executionToken: number;
}

interface RefreshRunningActions {
  shouldMarkRerunRequested: boolean;
  shouldRescheduleTimer: boolean;
}

interface RefreshCompletionActions {
  hasNewerRequest: boolean;
  shouldScheduleRerun: boolean;
  shouldClearRerunRequested: boolean;
}

interface StructureBoundsRefreshInput {
  currentChunk: string;
  isChunkTransitioning: boolean;
  oldHex?: { col: number; row: number } | null;
  newHex?: { col: number; row: number } | null;
  renderSize: { width: number; height: number };
  chunkSize: number;
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
 * Resolve refresh token execution behavior for latest-wins refresh scheduling.
 */
export function resolveRefreshExecutionPlan(scheduledToken: number, latestToken: number): RefreshExecutionPlan {
  const shouldApplyScheduled = shouldApplyRefreshToken(scheduledToken, latestToken);
  const executionToken = shouldApplyScheduled
    ? scheduledToken
    : resolveRefreshExecutionToken(scheduledToken, latestToken);

  return {
    shouldApplyScheduled,
    shouldRecordSuperseded: !shouldApplyScheduled,
    executionToken,
  };
}

/**
 * Resolve actions when a refresh request arrives while a refresh is already running.
 */
export function resolveRefreshRunningActions(scheduledToken: number, latestToken: number): RefreshRunningActions {
  return {
    shouldMarkRerunRequested: true,
    shouldRescheduleTimer: shouldRescheduleRefreshToken(scheduledToken, latestToken),
  };
}

/**
 * Resolve completion behavior after a refresh execution has settled.
 */
export function resolveRefreshCompletionActions(input: {
  appliedToken: number;
  latestToken: number;
  rerunRequested: boolean;
}): RefreshCompletionActions {
  const hasNewerRequest = input.appliedToken !== input.latestToken;
  const shouldScheduleRerun = hasNewerRequest || input.rerunRequested;

  return {
    hasNewerRequest,
    shouldScheduleRerun,
    shouldClearRerunRequested: shouldScheduleRerun,
  };
}

/**
 * Structure updates should trigger a tile refresh only when old/new positions
 * intersect the active render bounds and the scene is stable.
 */
export function shouldRequestTileRefreshForStructureBoundsChange(input: StructureBoundsRefreshInput): boolean {
  if (input.currentChunk === "null" || input.isChunkTransitioning) {
    return false;
  }

  const [startRow, startCol] = input.currentChunk.split(",").map(Number);
  if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
    return false;
  }

  const { minCol, maxCol, minRow, maxRow } = getRenderFetchBoundsForChunk(
    input.currentChunk,
    input.renderSize,
    input.chunkSize,
  );

  const affectsBounds = (hex?: { col: number; row: number } | null): boolean =>
    Boolean(hex && hex.col >= minCol && hex.col <= maxCol && hex.row >= minRow && hex.row <= maxRow);

  return affectsBounds(input.oldHex) || affectsBounds(input.newHex);
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
 * Biome-delta duplicate tile updates should bypass debounced refresh flow and
 * trigger immediate reconciliation while chunk state is stable.
 */
export function shouldRunImmediateDuplicateTileRefresh(input: DuplicateTileRefreshDecisionInput): boolean {
  if (input.removeExplored || !input.tileAlreadyKnown) {
    return false;
  }

  if (input.currentChunk === "null" || input.isChunkTransitioning) {
    return false;
  }

  return input.hasBiomeDelta === true;
}

/**
 * Duplicate tile updates can indicate a missed visual apply while data state is
 * already present. Force a chunk refresh only when the duplicate touches the
 * active visible chunk and no transition is in progress.
 */
export function shouldForceRefreshForDuplicateTileUpdate(input: DuplicateTileRefreshDecisionInput): boolean {
  if (input.removeExplored) {
    return false;
  }

  if (!input.tileAlreadyKnown) {
    return false;
  }

  // Biome delta on a known tile indicates stale visual state; force immediate reconcile.
  if (shouldRunImmediateDuplicateTileRefresh(input)) {
    return true;
  }

  if (input.currentChunk === "null" || input.isChunkTransitioning) {
    return false;
  }

  return input.isVisibleInCurrentChunk;
}

/**
 * Resolve duplicate tile update behavior as an explicit decision matrix mode.
 */
export function resolveDuplicateTileUpdateMode(input: DuplicateTileRefreshDecisionInput): DuplicateTileUpdateMode {
  if (input.removeExplored || !input.tileAlreadyKnown) {
    return "none";
  }

  if (shouldForceRefreshForDuplicateTileUpdate(input)) {
    return "invalidate_and_refresh";
  }

  return "invalidate_only";
}

/**
 * Duplicate tile updates can indicate stale visual state despite data parity.
 * Invalidate caches for duplicate adds and request a refresh only when visible.
 */
export function resolveDuplicateTileUpdateActions(
  input: DuplicateTileRefreshDecisionInput,
): DuplicateTileUpdateActions {
  const mode = resolveDuplicateTileUpdateMode(input);
  switch (mode) {
    case "none":
      return {
        shouldInvalidateCaches: false,
        shouldRequestRefresh: false,
      };
    case "invalidate_only":
      return {
        shouldInvalidateCaches: true,
        shouldRequestRefresh: false,
      };
    case "invalidate_and_refresh":
      return {
        shouldInvalidateCaches: true,
        shouldRequestRefresh: true,
      };
  }
}

/**
 * Resolve the full duplicate-tile reconcile plan, including whether refresh
 * should be immediate or deferred through chunk refresh scheduling.
 */
export function resolveDuplicateTileReconcilePlan(
  input: DuplicateTileRefreshDecisionInput,
): DuplicateTileReconcilePlan {
  const actions = resolveDuplicateTileUpdateActions(input);
  if (!actions.shouldInvalidateCaches) {
    return {
      shouldInvalidateCaches: false,
      refreshStrategy: "none",
    };
  }

  if (!actions.shouldRequestRefresh) {
    return {
      shouldInvalidateCaches: true,
      refreshStrategy: "none",
    };
  }

  return {
    shouldInvalidateCaches: true,
    refreshStrategy: shouldRunImmediateDuplicateTileRefresh(input) ? "immediate" : "deferred",
  };
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
