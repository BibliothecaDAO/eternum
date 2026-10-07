import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { endedDay } from "../hud/day-clock";
import { DayDoneCard } from "./day-done-card";
import { LastHourBubble } from "./last-hour";

const text = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body.textContent ?? "";

describe("the day's end", () => {
  const rules = { epochSeconds: 16 * 3_600, startMainAt: 0 };

  it("finds the day that ended last and its bounds, and none on the season's first day", () => {
    expect(endedDay(rules, 12 * 16 * 3_600 + 60)).toEqual({ day: 12, start: 11 * 16 * 3_600, end: 12 * 16 * 3_600 });
    expect(endedDay(rules, 60)).toBeNull();
  });

  it("tells the day done, the realm kept, the new day's end, tomorrow's length, the totals and the troops taken", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onContinue = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <DayDoneCard
          endedDay={12}
          realmArt="/images/realm-card/city.webp"
          clock={{ endsAt: undefined, secondsLeft: 7 * 3_600 + 55 * 60, tomorrowSeconds: 20 * 3_600, tone: "calm" }}
          totals={{ reveals: 31, cleared: 3, chests: 1, essence: 6_400, labor: 1_150, lords: undefined }}
          armies={3}
          troopsLost={6_021}
          returned={{ sent: 470, fitted: 200 }}
          onContinue={onContinue}
        />,
      ),
    );
    const card = host.querySelector("section[aria-label='Day 12 done']")!;
    expect(card.textContent).toContain("Realm kept · Day 13 is open");
    expect(card.textContent).toContain("7h 55m");
    expect(card.textContent).toContain("Tomorrow lasts20h");
    expect(card.textContent).toContain("+6,400");
    expect(card.textContent).toContain("—");
    expect(card.textContent).toContain("−6,021");
    expect(card.textContent).toContain("+200470");
    act(() => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(onContinue).toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });

  it("bubbles the troops still out in the last hour, and leaves out what the facts do not carry", () => {
    expect(text(renderToStaticMarkup(<LastHourBubble troopsOut={6_021} />))).toBe("6,021");
    expect(text(renderToStaticMarkup(<LastHourBubble troopsOut={6_021} returned={470} tiersToBuy={2} />))).toBe(
      "6,021+4702",
    );
  });
});
