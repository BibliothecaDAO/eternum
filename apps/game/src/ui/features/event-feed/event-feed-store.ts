import type { ReactNode } from "react";
import { create } from "zustand";

export type FeedNoticeKind = "info" | "success" | "error" | "warning" | "custom";

/** A transient notice: something that happened that no entity or transaction row carries. Ephemera, never a fact. */
export interface FeedNotice {
  id: string;
  kind: FeedNoticeKind;
  title: ReactNode;
  description?: ReactNode;
  at: number;
  /** How long the ticker shows it; the feed panel keeps it until it scrolls off the recent list. */
  ttlMs: number;
}

const MAX_NOTICES = 50;
const DEFAULT_NOTICE_TTL_MS = 6_000;

interface EventFeedStore {
  notices: FeedNotice[];
  push: (notice: Omit<FeedNotice, "id" | "at" | "ttlMs"> & { id?: string; ttlMs?: number }) => string;
  dismiss: (id?: string) => void;
}

let nextNoticeId = 0;

/**
 * The event feed's own state: notices. Transaction rows come from the transaction store and arrival rows from the
 * `resourceArrivals` slice — the feed derives its rows from those, it never copies them.
 */
export const useEventFeedStore = create<EventFeedStore>()((set) => ({
  notices: [],
  push: ({ id, ttlMs = DEFAULT_NOTICE_TTL_MS, ...notice }) => {
    const noticeId = id ?? `notice-${++nextNoticeId}`;
    set((state) => ({
      notices: [
        { ...notice, id: noticeId, ttlMs, at: Date.now() },
        ...state.notices.filter((n) => n.id !== noticeId),
      ].slice(0, MAX_NOTICES),
    }));
    return noticeId;
  },
  dismiss: (id) => set((state) => ({ notices: id === undefined ? [] : state.notices.filter((n) => n.id !== id) })),
}));
