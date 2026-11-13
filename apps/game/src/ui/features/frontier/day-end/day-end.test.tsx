import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { frontierSiteName, StructureType } from "@bibliothecadao/types";

import type { DayClock } from "../hud/day-clock";
import { TodaySheet } from "../log/today-sheet";
import { type DayEnd, DayEndBlock, dayEndItems, DayEndNotice } from "./day-end";

const HOUR = 3_600;
const clockAt = (secondsLeft: number): DayClock => ({
  day: 12,
  endsAt: 1_800_000_000,
  secondsLeft,
  tomorrowSeconds: 12 * HOUR,
  shareLeft: secondsLeft / (16 * HOUR),
  tone: secondsLeft <= HOUR ? "ember" : "calm",
});
const EVERYTHING_LEFT = dayEndItems({ claimWaiting: true, camp: { x: 4, y: 9 }, armyCanExplore: true });

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
  it("lists only what is still to do, today's camp by its Frontier name", () => {
    expect(EVERYTHING_LEFT.map(({ line, verb }) => `${line} · ${verb}`)).toEqual([
      "Claim today's Labor · Claim",
      `Clear today's ${frontierSiteName(StructureType.Camp)} · Show`,
      "Your army can explore · Select",
    ]);
    expect(dayEndItems({ claimWaiting: false, camp: null, armyCanExplore: true }).map(({ key }) => key)).toEqual([
      "explore",
    ]);
    expect(dayEndItems({ claimWaiting: false, camp: null, armyCanExplore: false })).toEqual([]);
  });

  it("says nothing before the last hour, then when the day ends and what is left, red in its last ten minutes", () => {
    const onOpen = vi.fn();
    const notice = (secondsLeft: number, items = EVERYTHING_LEFT) =>
      render(<DayEndNotice dayEnd={{ clock: clockAt(secondsLeft), items, run: vi.fn() }} onOpen={onOpen} />);

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

    const finalMinutes = notice(9 * 60, []);
    expect(finalMinutes.host.querySelector(".ui-notice")!.textContent).toBe("Day 12 ends in 9m" + "Open");
    expect(finalMinutes.host.querySelector(".ui-notice")!.getAttribute("data-tone")).toBe("bad");
    finalMinutes.unmount();
  });

  it("says in one line what the end takes, then each thing left with the button that does it", () => {
    const run = vi.fn();
    const dayEnd: DayEnd = { clock: clockAt(42 * 60), items: EVERYTHING_LEFT, run };
    const block = render(<DayEndBlock dayEnd={dayEnd} />);
    expect(block.host.querySelector(".ui-notice")!.textContent).toBe(
      "At day end, today's map and armies go",
    );
    act(() => block.button("Show")!.click());
    act(() => block.button("Claim")!.click());
    expect(run.mock.calls).toEqual([["camp"], ["claim"]]);
    block.unmount();
  });

  it("stands in Today on today's page only", () => {
    const sheet = (today: boolean) =>
      render(
        <TodaySheet
          day={today ? 12 : 11}
          today={today}
          clock={clockAt(42 * 60)}
          totals={{ reveals: 0, cleared: 0, chests: 0, essence: 0, labor: 0, lords: 0 }}
          dayEnd={<DayEndBlock dayEnd={{ clock: clockAt(42 * 60), items: EVERYTHING_LEFT, run: vi.fn() }} />}
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
