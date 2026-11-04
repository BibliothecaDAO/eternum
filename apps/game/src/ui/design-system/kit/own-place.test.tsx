// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { AppBoard, type AppBoardEntry } from "./app-elements";
import { HudTableRow } from "./hud-elements";

/** A board of 300 players, the player 200th: far more than its scroll area shows. */
const opened = vi.fn();
const entries: AppBoardEntry[] = Array.from({ length: 300 }, (_, index) => ({
  key: `0x${index + 1}`,
  lead: index + 1,
  name: index === 199 ? "You" : `Lord ${index + 1}`,
  figures: [{ icon: "lords", value: String(300 - index) }],
  own: index === 199,
  onClick: () => opened(index + 1),
}));

const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
afterEach(() => {
  act(() => root.render(null));
  opened.mockClear();
});

const mount = (board: readonly AppBoardEntry[]) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => root.render(<AppBoard entries={board} rows={10} />));
  const area = host.querySelector<HTMLElement>(".app-board-scroll")!;
  const own = host.querySelector<HTMLElement>(".app-board__item[data-own]")!;
  return { area, own, ownRow: own.querySelector<HTMLButtonElement>("button")! };
};

/**
 * The area's geometry as a browser lays it out: 10 rows of 56 px shown, scrolled to `scrollTop`, its rows stacked from
 * its top; the player's row stands wherever it waits.
 */
const layOut = (area: HTMLElement, scrollTop: number) => {
  Object.defineProperties(area, {
    scrollTop: { configurable: true, value: scrollTop },
    clientHeight: { configurable: true, value: 560 },
  });
  area.style.overflowY = "auto";
  area.scrollTo = vi.fn() as unknown as typeof area.scrollTo;
  area.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  [...area.querySelectorAll<HTMLElement>(".app-board__item")].forEach((item, index) => {
    Object.defineProperty(item, "offsetHeight", { configurable: true, value: 56 });
    item.getBoundingClientRect = () =>
      ({ top: index * 56 - scrollTop, bottom: (index + 1) * 56 - scrollTop }) as DOMRect;
  });
};

it("stands every place on the board in a scroll area of its rows, the player's own the one row held at its foot", () => {
  const { area } = mount(entries);
  expect(area.style.getPropertyValue("--app-board-rows")).toBe("10");
  const items = [...area.querySelectorAll(".app-board__item")];
  expect(items).toHaveLength(300);
  expect(items.flatMap((item, index) => (item.hasAttribute("data-own") ? [index + 1] : []))).toEqual([200]);
  expect(items[199]!.textContent).toBe("200You101");
});

it("brings the player's place into the middle of the area when their row is pressed waiting at the foot", () => {
  const { area, ownRow } = mount(entries);
  layOut(area, 0);
  act(() => ownRow.click());
  // The 200th row starts 199 rows down; centred in a 10-row area, 4.5 rows show above it.
  expect(area.scrollTo).toHaveBeenCalledWith({ top: 199 * 56 - (560 - 56) / 2, behavior: "smooth" });
  expect(opened).not.toHaveBeenCalled();
});

it("brings the player's place back into view when their row is pressed waiting at the top, scrolled past", () => {
  const { area, ownRow } = mount(entries);
  layOut(area, 250 * 56);
  act(() => ownRow.click());
  expect(area.scrollTo).toHaveBeenCalledWith({ top: 199 * 56 - (560 - 56) / 2, behavior: "smooth" });
  expect(opened).not.toHaveBeenCalled();
});

it("opens the player's row as any row once its place shows", () => {
  const { area, ownRow } = mount(entries);
  layOut(area, 195 * 56);
  act(() => ownRow.click());
  expect(area.scrollTo).not.toHaveBeenCalled();
  expect(opened).toHaveBeenCalledWith(200);
});

it("makes the player's row a button even on a board whose rows open nothing, so it can find its place", () => {
  const { area, ownRow } = mount(entries.map(({ onClick: _opens, ...entry }) => entry));
  expect(area.querySelectorAll("button")).toHaveLength(1);
  layOut(area, 0);
  act(() => ownRow.click());
  expect(area.scrollTo).toHaveBeenCalledTimes(1);
});

/** A HUD table of 87 rows of 40 px in a 400 px area under a 40 px head, the player 60th, scrolled to `scrollTop`. */
const hudTable = (scrollTop: number, { disabled = false } = {}) => {
  const open = vi.fn();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() =>
    root.render(
      <div style={{ overflowY: "auto" }}>
        {Array.from({ length: 87 }, (_, index) => (
          <HudTableRow
            key={index}
            cols="1fr"
            label={`#${index + 1}`}
            own={index === 59}
            disabled={disabled}
            onClick={() => open(index + 1)}
          >
            {index + 1}
          </HudTableRow>
        ))}
      </div>,
    ),
  );
  const area = host.firstElementChild as HTMLElement;
  Object.defineProperties(area, {
    scrollTop: { configurable: true, value: scrollTop },
    clientHeight: { configurable: true, value: 400 },
  });
  area.scrollTo = vi.fn() as unknown as typeof area.scrollTo;
  area.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  [...area.children].forEach((row, index) => {
    (row as HTMLElement).style.setProperty("--ui-table-head", "40px");
    Object.defineProperty(row, "offsetHeight", { configurable: true, value: 40 });
    row.getBoundingClientRect = () =>
      ({ top: index * 40 - scrollTop, bottom: (index + 1) * 40 - scrollTop }) as DOMRect;
  });
  return { area, open, own: area.querySelector<HTMLButtonElement>(".ui-table-row[data-own]")! };
};

/** Where the 60th row's place lands centred in what the head leaves of the area. */
const HUD_MIDDLE = { top: 59 * 40 - 40 - (400 - 40 - 40) / 2, behavior: "smooth" };

it("holds the player's row of a HUD table in sight too, and its press finds its place under the head before it opens", () => {
  const below = hudTable(0);
  expect([below.own.ariaLabel, below.own.getAttribute("aria-current")]).toEqual(["#60", "true"]);
  act(() => below.own.click());
  expect(below.area.scrollTo).toHaveBeenCalledWith(HUD_MIDDLE);
  expect(below.open).not.toHaveBeenCalled();
  // Scrolled past: the 60th place is above, waiting under the head.
  const above = hudTable(70 * 40);
  act(() => above.own.click());
  expect(above.area.scrollTo).toHaveBeenCalledWith(HUD_MIDDLE);
  // Its place in sight: the press is the row's own.
  const shown = hudTable(55 * 40);
  act(() => shown.own.click());
  expect(shown.area.scrollTo).not.toHaveBeenCalled();
  expect(shown.open).toHaveBeenCalledWith(60);
});

it("lets the player's row find its place when its own action leads nowhere, and does nothing in place", () => {
  const below = hudTable(0, { disabled: true });
  expect([below.own.disabled, below.own.getAttribute("aria-disabled")]).toEqual([false, "true"]);
  expect(below.area.querySelectorAll("button:disabled")).toHaveLength(86);
  act(() => below.own.click());
  expect(below.area.scrollTo).toHaveBeenCalledWith(HUD_MIDDLE);
  const shown = hudTable(55 * 40, { disabled: true });
  act(() => shown.own.click());
  expect(shown.area.scrollTo).not.toHaveBeenCalled();
  expect(shown.open).not.toHaveBeenCalled();
});
