import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { DayClock } from "../hud/day-clock";
import { TodaySheet } from "../log/today-sheet";
import { DayEndBlock, DayEndNotice } from "./day-end";

const HOUR = 3_600;
const clockAt = (secondsLeft: number): DayClock => ({
  day: 12,
  endsAt: 1_800_000_000,
  secondsLeft,
  tomorrowSeconds: 12 * HOUR,
  shareLeft: secondsLeft / (16 * HOUR),
  tone: secondsLeft <= HOUR ? "ember" : "calm",
});

const render = (view: ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(view));
  const button = (words: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === words);
  return {
    host,
    button,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

describe("the day's end", () => {
  it("says nothing before the last hour, then when the day ends and what is left, red in its last ten minutes", () => {
    const onOpen = vi.fn();
    const notice = (secondsLeft: number) =>
      render(<DayEndNotice dayEnd={{ clock: clockAt(secondsLeft) }} onOpen={onOpen} />);

    const calm = notice(2 * HOUR);
    expect(calm.host.textContent).toBe("");
    calm.unmount();

    const lastHour = notice(42 * 60);
    const line = lastHour.host.querySelector(".ui-notice")!;
    // The count of what is left is Today's to say: the notice keeps one line with Open (owner, 6 November).
    expect(line.textContent).toBe("Day 12 ends in 42m" + "Open");
    expect(line.getAttribute("data-tone")).toBe("warn");
    act(() => lastHour.button("Open")!.click());
    expect(onOpen).toHaveBeenCalledOnce();
    lastHour.unmount();

    const finalMinutes = notice(9 * 60);
    expect(finalMinutes.host.querySelector(".ui-notice")!.textContent).toBe("Day 12 ends in 9m" + "Open");
    expect(finalMinutes.host.querySelector(".ui-notice")!.getAttribute("data-tone")).toBe("bad");
    finalMinutes.unmount();
  });

  it("says in one line what the end takes, and offers no action", () => {
    const block = render(<DayEndBlock />);
    expect(block.host.querySelector(".ui-notice")!.textContent).toBe("At day end, today's map and armies go");
    expect(block.host.querySelectorAll("button")).toHaveLength(0);
    block.unmount();
  });

  it("stands in Today on today's page only", () => {
    const sheet = (today: boolean) =>
      render(
        <TodaySheet
          day={today ? 12 : 11}
          today={today}
          clock={clockAt(42 * 60)}
          totals={{ reveals: 0, cleared: 0, essence: 0, labor: 0 }}
          dayEnd={<DayEndBlock />}
          lines={[]}
          history="whole"
          onRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    const goes = '[aria-label="At day end, today\'s map and armies go"]';
    const today = sheet(true);
    expect(today.host.querySelector(goes)).not.toBeNull();
    today.unmount();
    const earlier = sheet(false);
    expect(earlier.host.querySelector(goes)).toBeNull();
    earlier.unmount();
  });
});
