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
  const bars = [...host.querySelectorAll<HTMLElement>(".ui-meter")].map((bar) => bar.querySelector("i")!.style.width);
  act(() => root.unmount());
  return bars;
};

it("draws one unbroken bar filled to the share of the maximum held", () => {
  expect(barsOf({ current: 50, max: 120, perExplore: 20 })).toEqual(["41.66666666666667%"]);
  expect(barsOf({ current: 150, max: 150, perExplore: 20 })).toEqual(["100%"]);
});

it("draws one empty bar while the stamina is unknown", () => {
  expect(barsOf(undefined)).toEqual(["0%"]);
});
