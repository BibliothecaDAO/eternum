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

it("holds the player's row of a HUD table at its foot too, and its press there finds its place before it opens", () => {
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
            onClick={() => open(index + 1)}
          >
            {index + 1}
          </HudTableRow>
        ))}
      </div>,
    ),
  );
  const area = host.firstElementChild as HTMLElement;
  const own = [...area.querySelectorAll<HTMLButtonElement>(".ui-table-row[data-own]")];
  expect(own.map((row) => [row.ariaLabel, row.getAttribute("aria-current")])).toEqual([["#60", "true"]]);
  Object.defineProperties(area, { scrollTop: { value: 0 }, clientHeight: { value: 400 } });
  area.scrollTo = vi.fn() as unknown as typeof area.scrollTo;
  area.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  [...area.children].forEach((row, index) => {
    Object.defineProperty(row, "offsetHeight", { value: 40 });
    row.getBoundingClientRect = () => ({ top: index * 40, bottom: (index + 1) * 40 }) as DOMRect;
  });
  act(() => own[0]!.click());
  expect(area.scrollTo).toHaveBeenCalledWith({ top: 59 * 40 - (400 - 40) / 2, behavior: "smooth" });
  expect(open).not.toHaveBeenCalled();
});
