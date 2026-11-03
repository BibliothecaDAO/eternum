// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { useKeyboardHeight, useKeyboardInset } from "./use-keyboard-inset";

/** A phone's visual viewport: the part of the 844 px layout the player sees, which a keyboard shrinks and a zoom scales. */
class Visual extends EventTarget {
  height = 844;
  offsetTop = 0;
  scale = 1;
  show(height: number, offsetTop = 0, scale = 1) {
    this.height = height;
    this.offsetTop = offsetTop;
    this.scale = scale;
    this.dispatchEvent(new Event("resize"));
  }
}

let visual: Visual;
let root: Root;
/** The keyboard's height as the code that measures with it reads it, drawn. */
const Probe = () => {
  useKeyboardInset();
  return <output>{useKeyboardHeight()}</output>;
};
let page: HTMLDivElement;
let field: HTMLInputElement;
const read = () => Number(page.querySelector("output")!.textContent);
/** The player taps a field: its keyboard is what the visual viewport then loses. */
const typeIn = () => act(() => field.focus());
const keyboard = () => ({
  inset: document.documentElement.style.getPropertyValue("--keyboard"),
  open: document.documentElement.dataset.keyboard ?? null,
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  visual = new Visual();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: visual });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 844 });
  page = document.createElement("div");
  field = document.createElement("input");
  document.body.append(page, field);
  root = createRoot(page);
  act(() => root.render(<Probe />));
});
afterEach(() => {
  act(() => root.unmount());
  page.remove();
  field.remove();
  Reflect.deleteProperty(window, "visualViewport");
  Reflect.deleteProperty(document.documentElement, "clientHeight");
});

it("says how tall the on-screen keyboard is, and that it is open, while it is", () => {
  expect(keyboard()).toEqual({ inset: "0px", open: null });
  typeIn();
  // Android Chrome: the keyboard overlays the page's foot, the layout unchanged.
  act(() => visual.show(508));
  expect(keyboard()).toEqual({ inset: "336px", open: "open" });
  act(() => visual.show(844));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
});

it("reads iOS Safari's keyboard too, the visible part pushed up the page", () => {
  typeIn();
  act(() => visual.show(508, 120));
  expect(keyboard()).toEqual({ inset: "216px", open: "open" });
});

it("takes a browser bar coming and going for no keyboard", () => {
  typeIn();
  act(() => visual.show(784));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
});

it("leaves the page as it was once gone", () => {
  typeIn();
  act(() => visual.show(508));
  act(() => root.unmount());
  expect(keyboard()).toEqual({ inset: "", open: null });
  page = document.createElement("div");
  root = createRoot(page);
  act(() => root.render(<Probe />));
});

it("tells the code that measures with it the height on every change, a scroll alone included", () => {
  typeIn();
  act(() => visual.show(508, 100));
  expect(read()).toBe(236);
  act(() => {
    visual.offsetTop = 0;
    visual.dispatchEvent(new Event("scroll"));
  });
  expect(read()).toBe(336);
  act(() => visual.show(844));
  expect(read()).toBe(0);
});

it("takes the visual viewport shrinking with no field focused for no keyboard: nothing is typed in", () => {
  act(() => visual.show(508));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
  // A checkbox or a button takes a tap and raises no keyboard either.
  const box = document.createElement("input");
  box.type = "checkbox";
  document.body.append(box);
  act(() => box.focus());
  act(() => visual.show(500));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
  box.remove();
});

it("takes a pinch-zoom for no keyboard, a field focused or not, and the keyboard again once the zoom is undone", () => {
  // Zoomed to twice the size the page shows half of itself, its foot out of view as under a keyboard.
  act(() => visual.show(422, 0, 2));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
  typeIn();
  act(() => visual.show(422, 0, 2));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
  act(() => visual.show(508, 0, 1));
  expect(keyboard()).toEqual({ inset: "336px", open: "open" });
});

it("takes the window resized or turned for no keyboard, while a field is focused", () => {
  typeIn();
  // Turned sideways: the layout and what is seen of it change together, nothing hidden at the foot.
  act(() => {
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 390 });
    visual.show(390);
  });
  expect(keyboard()).toEqual({ inset: "0px", open: null });
  act(() => {
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 844 });
    visual.show(844);
  });
  expect(keyboard()).toEqual({ inset: "0px", open: null });
});

it("closes when the keyboard is put away and the field keeps the focus, and when the focus leaves the field", async () => {
  typeIn();
  act(() => visual.show(508));
  expect(keyboard().open).toBe("open");
  // Android's back puts the keyboard away and leaves the field focused: the page shows its foot again.
  act(() => visual.show(844));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
  expect(document.activeElement).toBe(field);
  // Up again, then the focus leaves before the viewport has caught up: the keyboard is counted closed all the same.
  act(() => visual.show(508));
  await act(async () => {
    field.blur();
    await new Promise((settled) => setTimeout(settled, 0));
  });
  expect(keyboard()).toEqual({ inset: "0px", open: null });
});
