import { ActionRefusedError, wasReported } from "@bibliothecadao/types";
import { extractReadableErrorMessage } from "@/utils/error-message";

import { type FeedNoticeKind, useEventFeedStore } from "./event-feed-store";

interface NoticeOptions {
  description?: string;
  duration?: number;
  id?: string;
  location?: { x: number; y: number };
}

const push = (kind: FeedNoticeKind, title: string, options?: NoticeOptions): string =>
  useEventFeedStore.getState().push({
    kind,
    title,
    description: options?.description,
    id: options?.id,
    ttlMs: options?.duration,
    location: options?.location,
  });

/** An action that did not happen, as the player is told: `refused` (the game takes no action yet: news) or failed. */
export interface ActionFailure {
  refused: boolean;
  reason: string;
}

/**
 * What an action's failure says, the one reading every failure handler makes: an action the game does not take yet
 * (ActionRefusedError: "Starts in 2m 33s") is `refused`, its reason kept and never logged; any other failure gives the
 * reason its error names (the shard's refusal, the game's revert), `fallback` when it names none. A failure is logged
 * once: the system call logs its own (with its report), and this logs only one that never reached it.
 */
export const actionFailure = (error: unknown, fallback: string): ActionFailure => {
  if (error instanceof ActionRefusedError) return { refused: true, reason: error.message };
  if (!wasReported(error)) console.error(fallback, error);
  return { refused: false, reason: extractReadableErrorMessage(error, fallback) };
};

/**
 * The one way to say something happened: a notice in the event feed (ticker + panel), in words. The call shape follows
 * the toast library it replaced so every call site reads the same; nothing renders outside the feed.
 */
export const toast = Object.assign((title: string, options?: NoticeOptions) => push("info", title, options), {
  info: (title: string, options?: NoticeOptions) => push("info", title, options),
  /**
   * Success the player cannot see otherwise. Never a chain action's: its transaction row tells it, then its story, and
   * a notice beside them would tell the one action twice.
   */
  success: (title: string, options?: NoticeOptions) => push("success", title, options),
  error: (title: string, options?: NoticeOptions) => push("error", title, options),
  /** An action that failed, as actionFailure reads it: a refusal told as news, a failure as an error. */
  failed: (error: unknown, fallback: string, options?: NoticeOptions) => {
    const { refused, reason } = actionFailure(error, fallback);
    return refused ? toast.info(reason, options) : toast.error(reason, options);
  },
  warning: (title: string, options?: NoticeOptions) => push("warning", title, options),
  dismiss: (id?: string) => useEventFeedStore.getState().dismiss(id),
});
