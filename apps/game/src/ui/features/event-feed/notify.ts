import type { ReactNode } from "react";
import { type FeedNoticeKind, useEventFeedStore } from "./event-feed-store";

interface NoticeOptions {
  description?: ReactNode;
  duration?: number;
  id?: string;
}

const push = (kind: FeedNoticeKind, title: ReactNode, options?: NoticeOptions): string =>
  useEventFeedStore.getState().push({
    kind,
    title,
    description: options?.description,
    id: options?.id,
    ttlMs: options?.duration,
  });

/**
 * The one way to say something happened: a notice in the event feed (ticker + panel). The call shape follows the
 * toast library it replaced so every call site reads the same; nothing renders outside the feed.
 */
export const toast = Object.assign((title: ReactNode, options?: NoticeOptions) => push("info", title, options), {
  info: (title: ReactNode, options?: NoticeOptions) => push("info", title, options),
  success: (title: ReactNode, options?: NoticeOptions) => push("success", title, options),
  error: (title: ReactNode, options?: NoticeOptions) => push("error", title, options),
  warning: (title: ReactNode, options?: NoticeOptions) => push("warning", title, options),
  custom: (render: (id: string) => ReactNode, options?: NoticeOptions): string => {
    const id = options?.id ?? `notice-custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return push("custom", render(id), { ...options, id });
  },
  dismiss: (id?: string) => useEventFeedStore.getState().dismiss(id),
});
