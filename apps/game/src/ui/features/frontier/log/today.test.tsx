import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { dayOf } from "@bibliothecadao/eternum";

import { Tooltip } from "@/ui/design-system/molecules/tooltip";
import { questCatalog } from "@bibliothecadao/types";

import { dayBounds, seasonDay } from "../hud/day-clock";
import { dayQuestFace } from "../day/day-quest-face";
import { TodaySheet } from "./today-sheet";

const DAY = 16 * 3_600;
const HOUR = 3_600;
const CLOCK = {
  day: 12,
  endsAt: 1_800_000_000,
  secondsLeft: 7 * HOUR + 14 * 60,
  tomorrowSeconds: 12 * HOUR,
  shareLeft: 0.45,
  tone: "calm" as const,
};
const gains = { essence: 4_150, labor: undefined, glory: 1_180 };
const quest = (day: number) => dayQuestFace(questCatalog[day % questCatalog.length]!.id);
const WEEK = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
  day,
  quest: quest(day),
  when: day < 5 ? ("past" as const) : day === 5 ? ("today" as const) : ("ahead" as const),
  collected: day < 4,
}));

const render = (props: Partial<Parameters<typeof TodaySheet>[0]>) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <>
        <Tooltip />
        <TodaySheet day={12} clock={CLOCK} gains={gains} onClose={vi.fn()} {...props} />
      </>,
    ),
  );
  return { host, unmount: () => act(() => root.unmount()) };
};

describe("Today", () => {
  it("bounds any day of the season back from today, and none before the first or after today", () => {
    const calendar = {
      dayUnitSeconds: DAY / 4,
      seed: 1n,
      startMainAt: 0,
      scheduledEndAt: 21 * 20 * 14_400,
      endAt: 21 * 20 * 14_400,
    };
    const days = [dayOf(calendar, 0)!];
    while (days.length < 12) days.push(dayOf(calendar, days.at(-1)!.end)!);
    const now = days[11].start + 60;
    expect(dayBounds(calendar, now, 12)).toEqual({ start: days[11].start, end: days[11].end });
    expect(dayBounds(calendar, now, 3)).toEqual({ start: days[2].start, end: days[2].end });
    expect(dayBounds(calendar, now, 0)).toBeNull();
    expect(dayBounds(calendar, now, 13)).toBeNull();
  });

  it("counts today against the season's last day, and none outside the season (audit 10-27)", () => {
    const calendar = {
      dayUnitSeconds: DAY / 4,
      seed: 1n,
      startMainAt: 0,
      scheduledEndAt: 21 * 20 * 14_400,
      endAt: 21 * 20 * 14_400,
    };
    const days = [dayOf(calendar, 0)!];
    while (days.length < 14) days.push(dayOf(calendar, days.at(-1)!.end)!);
    const endsAt = days[13].end;
    expect(seasonDay({ ...calendar, endAt: endsAt }, days[9].start + 60)).toEqual({ day: 10, lastDay: 14 });
    expect(seasonDay({ ...calendar, endAt: endsAt }, days[13].end - 1)).toEqual({ day: 14, lastDay: 14 });
    expect(seasonDay({ ...calendar, endAt: endsAt }, endsAt)).toBeUndefined();
    expect(seasonDay({ ...calendar, endAt: endsAt }, -1)).toBeUndefined();
  });

  it("titles the day against the season's last day when it is known", () => {
    const { host, unmount } = render({ lastDay: 14 });
    expect(host.textContent).toContain("Day 12 of 14");
    unmount();
  });

  it("shows what the day earned, an unknown gain as a dash, and the Glory held", () => {
    const { host, unmount } = render({});
    expect(
      [...host.querySelectorAll("[data-total]")].map((cell) => [cell.getAttribute("aria-label"), cell.textContent]),
    ).toEqual([
      ["Essence +4.2K", "+4.2KEssence"],
      ["Labor —", "—Labor"],
      ["Glory 1.2K", "1.2KGlory"],
    ]);
    expect(host.textContent).not.toContain("Reveals");
    expect(host.textContent).not.toContain("Sites cleared");
    unmount();
  });

  it("says when today ends, the hours left in the day dial's tone, and how long tomorrow lasts", () => {
    const { host, unmount } = render({});
    expect(host.querySelector('[role="timer"]')?.textContent).toMatch(/^Ends \d\d:\d\dTomorrow lasts 12h$/);
    expect(host.querySelector('[data-tip="7h 14m left"]')?.textContent).toBe("7h 14m");
    expect(host.querySelector('[data-tip="7h 14m left"]')?.getAttribute("data-tone")).toBeNull();
    unmount();
    const lastHour = render({ clock: { ...CLOCK, secondsLeft: 42 * 60, tone: "ember" } });
    expect(lastHour.host.querySelector('[data-tip="42m left"]')?.getAttribute("data-tone")).toBe("bad");
    lastHour.unmount();
  });

  it("marks the week's collected quests and today's, and offers yesterday's recap only when there is one", () => {
    const onRecap = vi.fn();
    const { host, unmount } = render({ week: WEEK, onRecap });
    const days = [...host.querySelectorAll("[data-week-day]")];
    expect(days.map((day) => day.getAttribute("data-week-day"))).toEqual([
      "past",
      "past",
      "past",
      "past",
      "today",
      "ahead",
      "ahead",
    ]);
    expect(days.filter((day) => day.hasAttribute("data-collected"))).toHaveLength(3);
    act(() =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Yesterday's recap")!.click(),
    );
    expect(onRecap).toHaveBeenCalledOnce();
    unmount();
    const first = render({});
    expect(first.host.textContent).not.toContain("Yesterday's recap");
    first.unmount();
  });
});
