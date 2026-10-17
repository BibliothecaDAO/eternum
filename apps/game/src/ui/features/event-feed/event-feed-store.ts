import { create } from "zustand";

export type FeedNoticeKind = "info" | "success" | "error" | "warning";

/**
 * A transient notice: something that happened that no entity or transaction row carries. Ephemera, never a fact. Its
 * words are text, so it is one row like every other, never a layout of its own drawn into the feed.
 */
export interface FeedNotice {
  id: string;
  kind: FeedNoticeKind;
  title: string;
  description?: string;
  at: number;
  /** How long the ticker shows it; the feed panel keeps it until it scrolls off the recent list. */
  ttlMs: number;
  /** Where the notice happened, when the caller knows; a row with a location flies the camera. */
  location?: { x: number; y: number };
}

const MAX_NOTICES = 50;
const DEFAULT_NOTICE_TTL_MS = 6_000;

interface EventFeedStore {
  notices: FeedNotice[];
  push: (notice: Omit<FeedNotice, "id" | "at" | "ttlMs"> & { id?: string; ttlMs?: number }) => string;
  dismiss: (id?: string) => void;
}

let nextNoticeId = 0;

/** The same words again, as when one refused click is refused on two paths: one row, at the latest moment. */
const repeats = (notice: Pick<FeedNotice, "kind" | "title" | "description">, other: FeedNotice) =>
  other.kind === notice.kind && other.title === notice.title && other.description === notice.description;

/**
 * The event feed's own state: notices. Transaction rows come from the transaction store — the feed derives its rows
 * from it, it never copies them.
 */
export const useEventFeedStore = create<EventFeedStore>()((set) => ({
  notices: [],
  push: ({ id, ttlMs = DEFAULT_NOTICE_TTL_MS, ...notice }) => {
    const noticeId = id ?? `notice-${++nextNoticeId}`;
    set((state) => ({
      notices: [
        { ...notice, id: noticeId, ttlMs, at: Date.now() },
        ...state.notices.filter((n) => n.id !== noticeId && !repeats(notice, n)),
      ].slice(0, MAX_NOTICES),
    }));
    return noticeId;
  },
  dismiss: (id) => set((state) => ({ notices: id === undefined ? [] : state.notices.filter((n) => n.id !== id) })),
}));
