import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { useUnreadFeedCount } from "./events-card";
import type { ImportantFeedRow } from "./important-feed-rows";

const row = (at: number) => ({ kind: "story", id: `story:${at}`, at }) as unknown as ImportantFeedRow;

it("counts the rows that arrived since the log was last open, and none while it is open", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const mountedAt = Date.now();
  const Probe = ({ rows, logOpen }: { rows: ImportantFeedRow[]; logOpen: boolean }) => (
    <p>{useUnreadFeedCount(rows, logOpen)}</p>
  );
  const container = document.createElement("div");
  const root = createRoot(container);
  const unread = () => Number(container.textContent);
  const show = (rows: ImportantFeedRow[], logOpen: boolean) =>
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
