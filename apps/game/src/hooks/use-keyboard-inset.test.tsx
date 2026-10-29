// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { useKeyboardHeight, useKeyboardInset } from "./use-keyboard-inset";

/** A phone's visual viewport: the part of the 844 px layout the player sees, which a keyboard shrinks. */
class Visual extends EventTarget {
  height = 844;
  offsetTop = 0;
  show(height: number, offsetTop = 0) {
    this.height = height;
    this.offsetTop = offsetTop;
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
const read = () => Number(page.querySelector("output")!.textContent);
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
  root = createRoot(page);
  act(() => root.render(<Probe />));
});
afterEach(() => {
  act(() => root.unmount());
  Reflect.deleteProperty(window, "visualViewport");
  Reflect.deleteProperty(document.documentElement, "clientHeight");
});

it("says how tall the on-screen keyboard is, and that it is open, while it is", () => {
  expect(keyboard()).toEqual({ inset: "0px", open: null });
  // Android Chrome: the keyboard overlays the page's foot, the layout unchanged.
  act(() => visual.show(508));
  expect(keyboard()).toEqual({ inset: "336px", open: "open" });
  act(() => visual.show(844));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
});

it("reads iOS Safari's keyboard too, the visible part pushed up the page", () => {
  act(() => visual.show(508, 120));
  expect(keyboard()).toEqual({ inset: "216px", open: "open" });
});

it("takes a browser bar coming and going for no keyboard", () => {
  act(() => visual.show(784));
  expect(keyboard()).toEqual({ inset: "0px", open: null });
});

it("leaves the page as it was once gone", () => {
  act(() => visual.show(508));
  act(() => root.unmount());
  expect(keyboard()).toEqual({ inset: "", open: null });
  page = document.createElement("div");
  root = createRoot(page);
  act(() => root.render(<Probe />));
});

it("tells the code that measures with it the height on every change, a scroll alone included", () => {
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
