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
  /**
   * An action that failed, the one way every failure handler says so: the reason its error names (the shard's refusal,
   * the game's revert, the client's own gate), and `fallback` only when it names none.
   */
  failed: (error: unknown, fallback: string, options?: NoticeOptions) =>
    toast.error(extractReadableErrorMessage(error, fallback), options),
  warning: (title: string, options?: NoticeOptions) => push("warning", title, options),
  dismiss: (id?: string) => useEventFeedStore.getState().dismiss(id),
});
