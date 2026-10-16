import { afterEach, expect, it } from "vitest";

import { useEventFeedStore } from "./event-feed-store";
import { toast } from "./notify";

afterEach(() => useEventFeedStore.getState().dismiss());

const titles = () => useEventFeedStore.getState().notices.map((notice) => notice.title);

it("lists one refused click once, though two paths refused it", () => {
  toast.info("Starts in 2m 55s");
  toast.info("Starts in 2m 55s");
  expect(titles()).toEqual(["Starts in 2m 55s"]);
});

it("still lists different notices, and the same words of another kind", () => {
  toast.info("Starts in 2m 55s");
  toast.info("Starts in 2m 54s");
  toast.error("Starts in 2m 54s");
  expect(titles()).toEqual(["Starts in 2m 54s", "Starts in 2m 54s", "Starts in 2m 55s"]);
});
