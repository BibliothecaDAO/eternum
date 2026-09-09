import { expect, it } from "vitest";
import { orderHeadlineFeed, useHeadlineFeedStore } from "./headline-feed-store";
it("pins a major event for its tick, then returns it to the chronological feed without duplicates", () => {
  const headline = {
    id: "capture:1",
    type: "realm-fall" as const,
    icon: "realm-fall" as const,
    title: "Captured",
    description: "Realm captured",
    timestamp: 61000,
  };
  useHeadlineFeedStore.setState({ headlines: [] });
  useHeadlineFeedStore.getState().publish(headline);
  useHeadlineFeedStore.getState().publish(headline);
  expect(useHeadlineFeedStore.getState().headlines).toHaveLength(1);
  expect(orderHeadlineFeed([headline], 119000, 60)).toEqual({ pinned: [headline], recent: [] });
  expect(orderHeadlineFeed([headline], 120000, 60)).toEqual({ pinned: [], recent: [headline] });
});
