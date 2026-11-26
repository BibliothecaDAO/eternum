import { act } from "react";
import { createRoot } from "react-dom/client";
import { formatShortChange } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import type { DockArmy } from "../hud/dock-armies";
import { MapSiteCardView } from "./map-site-card";

const army = (current: number): DockArmy =>
  ({
    explorerId: 201,
    number: 1,
    label: "1,498 Knights",
    art: "knight-t1",
    stamina: { current, max: 180, perExplore: 20 },
    secondsToFull: undefined,
    troops: 1498,
    ethereal: undefined,
  }) as DockArmy;

const wellCard = (current: number, gain: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(<MapSiteCardView kind="Well" gain={gain} army={army(current)} taker={undefined} action={null} onClose={() => {}} />),
  );
  const user = host.querySelector("[data-site-user]")!;
  const read = {
    held: user.querySelector<HTMLElement>(".ui-meter > i:not([data-gain])")?.style.width ?? null,
    refill: user.querySelector<HTMLElement>(".ui-meter > i[data-gain]")?.style.width ?? null,
    change: user.querySelector(".whitespace-nowrap")?.textContent ?? null,
    chips: user.querySelectorAll(".ui-chip").length,
  };
  act(() => root.unmount());
  host.remove();
  return read;
};

it("shows the army's stamina as it is with the Well's refill beside it on one bar, its change on one line, and no other chip", () => {
  const card = wellCard(102, 72);
  expect(parseFloat(card.held!)).toBeCloseTo((102 / 180) * 100);
  expect(parseFloat(card.refill!)).toBeCloseTo((72 / 180) * 100);
  expect(card.change).toBe(formatShortChange(102, 174));
  expect(card.chips).toBe(0);
});

it("draws only the refill that fits under the bar's maximum", () => {
  const capped = wellCard(150, 72);
  expect(parseFloat(capped.refill!)).toBeCloseTo((30 / 180) * 100);
  expect(capped.change).toBe(formatShortChange(150, 180));
  expect(wellCard(180, 72).refill).toBeNull();
});
