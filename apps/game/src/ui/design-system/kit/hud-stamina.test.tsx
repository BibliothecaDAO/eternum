// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { HudStamina, type StaminaBar } from "./hud-elements";

/** Each segment of the bar as drawn: its length (1 is one explore) and its fill. */
const segmentsOf = (stamina: StaminaBar | undefined) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<HudStamina stamina={stamina} />));
  const segments = [...host.querySelectorAll<HTMLElement>(".ui-meter")].map((segment) => [
    Number(segment.style.flexGrow),
    segment.querySelector("i")!.style.width,
  ]);
  act(() => root.unmount());
  return segments;
};

it("cuts a bar into one segment per explore, filled up to the stamina held", () => {
  expect(segmentsOf({ current: 50, max: 120, perExplore: 20 })).toEqual([
    [1, "100%"],
    [1, "100%"],
    [1, "50%"],
    [1, "0%"],
    [1, "0%"],
    [1, "0%"],
  ]);
});

it("ends a maximum the explore cost does not divide in a shorter segment", () => {
  expect(segmentsOf({ current: 150, max: 150, perExplore: 20 })).toEqual([
    ...Array.from({ length: 7 }, () => [1, "100%"]),
    [0.5, "100%"],
  ]);
});

it("draws one empty segment while the stamina is unknown", () => {
  expect(segmentsOf(undefined)).toEqual([[1, "0%"]]);
});
