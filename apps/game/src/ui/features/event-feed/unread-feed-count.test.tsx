import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { useUnreadFeedCount } from "./quick-feed";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";

const row = (at: number) => ({ id: `story:${at}`, timestampMs: at }) as unknown as ProcessedStoryEvent;

it("counts the stories that arrived since the log was last open, and none while it is open", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const mountedAt = Date.now();
  const Probe = ({ rows, logOpen }: { rows: ProcessedStoryEvent[]; logOpen: boolean }) => (
    <p>{useUnreadFeedCount(rows, logOpen)}</p>
  );
  const container = document.createElement("div");
  const root = createRoot(container);
  const unread = () => Number(container.textContent);
  const show = (rows: ProcessedStoryEvent[], logOpen: boolean) =>
    act(async () => root.render(<Probe rows={rows} logOpen={logOpen} />));
  const arrived = [row(mountedAt - 1_000), row(mountedAt + 1_000), row(mountedAt + 2_000)];

  await show(arrived, false);
  expect(unread()).toBe(2);
  await show(arrived, true);
  expect(unread()).toBe(0);
  await show(arrived, false);
  expect(unread()).toBe(0);
  await show([...arrived, row(mountedAt + 3_000)], false);
  expect(unread()).toBe(1);
  await act(async () => root.unmount());
});
