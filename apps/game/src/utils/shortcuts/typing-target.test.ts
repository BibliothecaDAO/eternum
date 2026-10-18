// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";

import { isKeyForFocused, isKeyForSurface } from "./typing-target";

/** Enter pressed on the first element of `html`, as the browser delivers it to what has focus. */
const enterOn = (html: string) => {
  document.body.innerHTML = html;
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  document.body.firstElementChild!.querySelector("[data-focus]")!.dispatchEvent(event);
  return event;
};

afterEach(() => {
  document.body.innerHTML = "";
});

it("gives an open dialog the Enter pressed in it, which a map shortcut still may take", () => {
  const inDialog = enterOn('<div role="dialog"><p data-focus tabindex="-1"></p></div>');
  expect([isKeyForSurface(inDialog), isKeyForFocused(inDialog)]).toEqual([true, false]);
});

it("gives a focused tab the Enter that presses it, on the map and in a dialog alike", () => {
  const onTab = enterOn('<nav><div role="tab" tabindex="0" data-focus></div></nav>');
  expect([isKeyForSurface(onTab), isKeyForFocused(onTab)]).toEqual([true, true]);
});

it("leaves the Enter pressed on the page to the map", () => {
  const onPage = enterOn('<main><section data-focus tabindex="-1"></section></main>');
  expect([isKeyForSurface(onPage), isKeyForFocused(onPage)]).toEqual([false, false]);
});
