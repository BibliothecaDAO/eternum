// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";

import { HudBands } from "./hud-bands";

// A phone held upright, 844 px tall, whose keyboard the visual viewport reports. jsdom lays nothing out: the phone's
// foot is drawn as a browser draws the bands' column, which ends where the keyboard begins (--keyboard), the place bar
// 64 px tall at its foot while it shows, and no box at all while the keyboard hides it.
const SCREEN = 844;
const BAR = 64;
const keyboard = () => Number.parseFloat(document.documentElement.style.getPropertyValue("--keyboard") || "0");
const hidden = (element: Element) =>
  document.documentElement.dataset.keyboard === "open" && element.hasAttribute("data-keyboard-hides");

let visual: EventTarget & { height: number; offsetTop: number };
let root: Root;
let host: HTMLDivElement;
const observed: { measure: () => void; target?: Element }[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("innerHeight", SCREEN);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  visual = Object.assign(new EventTarget(), { height: SCREEN, offsetTop: 0 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: visual });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: SCREEN });
  observed.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      record: { measure: () => void; target?: Element };
      constructor(measure: () => void) {
        this.record = { measure };
        observed.push(this.record);
      }
      observe(target: Element) {
        this.record.target = target;
      }
      disconnect() {}
      unobserve() {}
    },
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (hidden(this)) return new DOMRect(0, 0, 0, 0);
    const foot = SCREEN - keyboard();
    // The place bar, or the box that holds it at the column's foot: as tall as the bar while it shows.
    const holdsBar =
      this.hasAttribute("data-keyboard-hides") || this.firstElementChild?.hasAttribute("data-keyboard-hides");
    if (holdsBar) {
      const bar = this.hasAttribute("data-keyboard-hides") ? this : this.firstElementChild!;
      const height = hidden(bar) ? 0 : BAR;
      return new DOMRect(0, foot - height, 390, height);
    }
    return new DOMRect(0, 0, 390, 100);
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "visualViewport");
  Reflect.deleteProperty(document.documentElement, "clientHeight");
});

/** Frontier's phone bands with an amount sheet open over them, the keyboard measured as the app measures it. */
const Phone = () => {
  useKeyboardInset();
  return (
    <HudBands strip={<div>Day</div>} nav={<nav aria-label="Places">Places</nav>}>
      <HudSheet label="Withdraw" onClose={() => {}}>
        <input aria-label="Amount" />
      </HudSheet>
    </HudBands>
  );
};
/** Where the sheet's foot stands, from the screen's top: the bands' foot offset, from the bottom. */
const sheetBottom = () =>
  SCREEN -
  Number.parseFloat(
    host.querySelector<HTMLElement>('[aria-label="Frontier HUD"]')!.style.getPropertyValue("--hud-phone-foot"),
  );
/** The browser telling the bands what changed: every box they watch, then the visual viewport. */
const relayout = () =>
  act(async () => {
    observed.forEach(({ measure }) => measure());
    visual.dispatchEvent(new Event("resize"));
  });

it("stands an amount sheet on the keyboard while it is open, and on the place bar again once it closes", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <Phone />
      </MemoryRouter>,
    ),
  );
  // On the place bar, 6 px above it.
  expect(sheetBottom()).toBe(SCREEN - BAR - 6);

  await act(async () => host.querySelector<HTMLInputElement>('input[aria-label="Amount"]')!.focus());
  await act(async () => {
    visual.height = 508;
    visual.dispatchEvent(new Event("resize"));
  });
  await relayout();
  // The bar steps aside; the sheet stands on the keyboard, whole in the 508 px left.
  expect(document.documentElement.dataset.keyboard).toBe("open");
  expect(sheetBottom()).toBe(508 - 6);

  await act(async () => {
    visual.height = SCREEN;
    visual.dispatchEvent(new Event("resize"));
  });
  await relayout();
  expect(sheetBottom()).toBe(SCREEN - BAR - 6);
});
