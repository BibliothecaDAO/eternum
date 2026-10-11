import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { dayOf } from "@bibliothecadao/eternum";

import { dayBounds } from "../hud/day-clock";
import { TodaySheet } from "./today-sheet";

const DAY = 16 * 3_600;
const totals = { reveals: 19, cleared: 2, chests: 0, essence: 4_150, labor: 550, lords: undefined };

const render = (props: Partial<Parameters<typeof TodaySheet>[0]>) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <TodaySheet
        day={12}
        today
        totals={totals}
        lines={[{ id: "a", at: 0, text: "Army 1 cleared a camp" }]}
        failed={false}
        onRetry={vi.fn()}
        onClose={vi.fn()}
        {...props}
      />,
    ),
  );
  return { host, unmount: () => act(() => root.unmount()) };
};

describe("Today", () => {
  it("bounds any day of the season back from today, and none before the first or after today", () => {
    const calendar = { dayUnitSeconds: DAY / 4, seed: 1n, startMainAt: 0 };
    const days = [dayOf(calendar, 0)!];
    while (days.length < 12) days.push(dayOf(calendar, days.at(-1)!.end)!);
    const now = days[11].start + 60;
    expect(dayBounds(calendar, now, 12)).toEqual({ start: days[11].start, end: days[11].end });
    expect(dayBounds(calendar, now, 3)).toEqual({ start: days[2].start, end: days[2].end });
    expect(dayBounds(calendar, now, 0)).toBeNull();
    expect(dayBounds(calendar, now, 13)).toBeNull();
  });

  it("shows the day's totals and log, an unknown total as a dash, and steps back but not past today", () => {
    const onEarlier = vi.fn();
    const { host, unmount } = render({ onEarlier });
    expect(host.textContent).toContain("Day 12");
    expect(host.textContent).toContain("+4,150");
    expect(host.textContent).toContain("—");
    expect(host.textContent).toContain("Army 1 cleared a camp");
    const later = host.querySelector<HTMLButtonElement>("button[aria-label='Day 13']")!;
    expect(later.disabled).toBe(true);
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Day 11']")!.click());
    expect(onEarlier).toHaveBeenCalled();
    unmount();
  });

  it("says the log did not answer, with Try again, in the log's place", () => {
    const onRetry = vi.fn();
    const { host, unmount } = render({ failed: true, onRetry });
    expect(host.textContent).toContain("Today did not answer.");
    expect(host.textContent).not.toContain("Army 1 cleared a camp");
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Try again")!.click());
    expect(onRetry).toHaveBeenCalled();
    unmount();
  });
});
