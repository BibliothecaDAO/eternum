// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { HudStamina, type StaminaBar } from "./hud-elements";

const barsOf = (stamina: StaminaBar | undefined) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<HudStamina stamina={stamina} />));
  const bars = [...host.querySelectorAll<HTMLElement>(".ui-meter")].map((bar) => [
    bar.querySelector("i")!.style.width,
    bar.style.getPropertyValue("--segment"),
  ]);
  act(() => root.unmount());
  return bars;
};

it("draws one bar filled to the share of the maximum held, cut every 30 stamina whatever an explore costs", () => {
  expect(barsOf({ current: 50, max: 120, perExplore: 20 })).toEqual([["41.66666666666667%", "25%"]]);
  expect(barsOf({ current: 150, max: 150, perExplore: 20 })).toEqual([["100%", "20%"]]);
  expect(barsOf({ current: 300, max: 600, perExplore: 10 })).toEqual([["50%", "5%"]]);
});

it("leaves a bar of 30 or less uncut, and one empty bar while the stamina is unknown", () => {
  expect(barsOf({ current: 10, max: 30, perExplore: 10 })).toEqual([["33.33333333333333%", ""]]);
  expect(barsOf(undefined)).toEqual([["0%", ""]]);
});
