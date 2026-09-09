import { create } from "zustand";
import type { Headline } from "./headline-types";
export const useHeadlineFeedStore = create<{ headlines: Headline[]; publish: (headline: Headline) => void }>()(
  (set) => ({
    headlines: [],
    publish: (headline) =>
      set((state) =>
        state.headlines.some((row) => row.id === headline.id)
          ? state
          : { headlines: [...state.headlines, headline].slice(-100) },
      ),
  }),
);
export function orderHeadlineFeed(headlines: Headline[], now: number, tickSeconds: number) {
  const tick = Math.floor(now / 1000 / tickSeconds);
  const pinned = headlines.filter((headline) => Math.floor(headline.timestamp / 1000 / tickSeconds) === tick);
  const recent = headlines.filter((headline) => Math.floor(headline.timestamp / 1000 / tickSeconds) !== tick);
  return { pinned: [...pinned].reverse(), recent: [...recent].reverse() };
}
