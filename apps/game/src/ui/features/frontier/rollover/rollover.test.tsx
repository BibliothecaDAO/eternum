import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { dayOf } from "@bibliothecadao/eternum";

import { RESTING, useDayEndStore, type DayEndPhase } from "@/hooks/store/use-day-end-store";

import { endedDay } from "../hud/day-clock";
import { DayDoneCard } from "./day-done-card";
import { DayEndScreen } from "./day-end-screen";
import { DAY_SHARE_WORDS } from "../../../design-system/kit/words";

describe("the day's end", () => {
  const rules = {
    dayUnitSeconds: 4 * 3_600,
    seed: 1n,
    startMainAt: 0,
    scheduledEndAt: 21 * 20 * 14_400,
    endAt: 21 * 20 * 14_400,
  };

  it("finds the day that ended last and its bounds, and none on the season's first day or once the season is over", () => {
    const first = dayOf(rules, 0)!;
    const second = dayOf(rules, first.end)!;
    expect(endedDay(rules, second.start + 60)).toEqual({ day: 1, start: first.start, end: first.end });
    expect(endedDay(rules, 60)).toBeNull();
    // The season ended with day 1: its turn and every later one end no day.
    expect(endedDay({ ...rules, endAt: first.end }, second.start + 60)).toBeNull();
    expect(endedDay({ ...rules, endAt: first.end }, second.end + 60)).toBeNull();
  });

  it("tells the day done in three numbers, then Share and Begin", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onContinue = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <DayDoneCard
          endedDay={12}
          clock={{ day: 13 }}
          gains={{ essence: 6_400, labor: undefined, glory: 900 }}
          history="whole"
          stories={[]}
          onRetry={vi.fn()}
          onShare={vi.fn()}
          onContinue={onContinue}
        />,
      ),
    );
    const card = host.querySelector("section[aria-label='Day 12 complete']")!;
    expect([...card.querySelectorAll("[data-total]")].map((cell) => cell.textContent)).toEqual([
      "+6.4KEssence",
      "—Labor",
      "900Glory",
    ]);
    expect(card.querySelector("[data-day-lines]")).toBeNull();
    const buttons = [...card.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.map((button) => button.textContent)).toEqual([DAY_SHARE_WORDS.share, "Begin Day 13"]);
    act(() => buttons[1]!.click());
    expect(onContinue).toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });

  it("draws the day's end over the map: nothing on a plain day, Skip in the mist, the summary until Continue, the black", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const show = (phase: DayEndPhase) =>
      act(() => {
        useDayEndStore.setState({ ...RESTING, phase, summary: "shown" });
        root.render(<DayEndScreen summary={<p>the summary</p>} />);
      });
    const black = () => host.querySelector<HTMLElement>("[data-day-end] > div:last-child")!.style.opacity;

    show("day");
    expect(host.innerHTML).toBe("");
    show("veil");
    expect(host.textContent).toBe("Skip");
    show("summary");
    expect(host.textContent).toBe("the summary");
    expect(host.querySelector<HTMLElement>("[data-day-end-scrim]")!.style.opacity).toBe("0.6");
    expect(black()).toBe("0");
    show("nightfall");
    expect(host.textContent).toBe("");
    expect(black()).toBe("1");
    show("black");
    expect(black()).toBe("1");
    show("dawn");
    expect(black()).toBe("0");
    act(() => root.unmount());
    useDayEndStore.setState(RESTING);
    host.remove();
  });
});
