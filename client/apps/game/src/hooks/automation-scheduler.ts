import { PROCESS_INTERVAL_MS } from "@/ui/features/infrastructure/automation/model/automation-processor";

/**
 * Earliest wall-clock time (ms) at which the next production pass is allowed.
 * - Enforces the global tick spacing (lastRun + PROCESS_INTERVAL_MS).
 * - Respects any enable-gate (`automationEnabledAtMs`) installed after enabling
 *   automation or after a `pruneForGame` reset, which should defer the first
 *   pass even if `lastRunMs` is old or missing.
 */
export const computeNextEligibleMs = (lastRunMs: number, automationEnabledAtMs: number): number =>
  Math.max(lastRunMs + PROCESS_INTERVAL_MS, automationEnabledAtMs);

/**
 * Align the next scheduler check to the next whole-second boundary, with a
 * 250ms minimum floor so back-to-back triggers don't spin the timer hot.
 */
export const computeScheduleDelayMs = (nowMs: number): number => {
  const nextBlockMs = (Math.floor(nowMs / 1000) + 1) * 1000;
  return Math.max(250, nextBlockMs - nowMs);
};

/**
 * Only advance the scheduler bookkeeping when the pass actually executed and
 * the game state didn't change under us mid-run (pruneForGame resets during an
 * in-flight run must win over the pass's clock advance).
 */
export const shouldAdvanceSchedulerBookkeeping = (ran: boolean, pruneDuringProcessing: boolean): boolean =>
  ran && !pruneDuringProcessing;

/**
 * Compute the updated scheduler refs after a successful pass, returning the
 * value to assign to `lastRunTimestampRef`, `automationEnabledAtRef`, and
 * `nextRunTimestampRef`.
 */
export const computePostPassSchedulerUpdate = (
  nowMs: number,
): { lastRunMs: number; automationEnabledAtMs: number; nextRunMs: number } => {
  const enabledAt = nowMs + PROCESS_INTERVAL_MS;
  return { lastRunMs: nowMs, automationEnabledAtMs: enabledAt, nextRunMs: enabledAt };
};
