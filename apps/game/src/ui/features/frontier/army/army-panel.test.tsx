// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { TroopType } from "@bibliothecadao/types";
import { COMBAT_MARK_WORDS, TROOP_TRAIT_WORDS, UNIT_DETAILS_WORDS } from "@/ui/design-system/kit/words";
import { troopTraits } from "../deploy/troop-figures";
import { EARLY_ARMY, PRESET_TROOP_FIGURES } from "../research/progression-fixture";
import { ArmyDetail } from "./army-panel";
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
it("shows the troop class mark and trait strip instead of a duplicated count, beside stamina and Full in", () => {
  act(() => root.render(<ArmyDetail army={{ ...EARLY_ARMY, stamina: { current: 18, max: 140, perExplore: 20 } }} />));
  const stats = host.querySelector('[data-army-step="stats"]')!;
  expect(stats.querySelector('[aria-label="1,500 troops"]')).toBeNull();
  expect(stats.querySelector(`[data-combat-mark="${COMBAT_MARK_WORDS.blade}"]`)).not.toBeNull();
  const strip = stats.querySelector("[data-troop-trait-strip]")!;
  expect(strip.textContent).toContain(COMBAT_MARK_WORDS.blade);
  for (const pill of TROOP_TRAIT_WORDS.pills(troopTraits(EARLY_ARMY.category!), PRESET_TROOP_FIGURES)) {
    expect(strip.textContent).toContain(pill);
  }
  expect(strip.textContent).not.toContain(UNIT_DETAILS_WORDS.beastHeadline.bow);
  expect(strip.textContent).not.toContain(UNIT_DETAILS_WORDS.strikeRule.blade);
  expect(strip.textContent).not.toContain("· -");
  expect(stats.textContent).toContain("Full in 4h");
  const meter = host.querySelector('[role="meter"][aria-label="stamina"]')!;
  expect([meter.getAttribute("aria-valuenow"), meter.getAttribute("aria-valuemax")]).toEqual(["18", "140"]);
  expect([...meter.querySelectorAll<HTMLElement>("i")].map((fill) => fill.style.width)).toEqual([
    `${(18 / 140) * 100}%`,
  ]);
  expect(meter.closest("[data-stamina-line]")!.textContent).toBe("18/140");

  act(() =>
    root.render(
      <ArmyDetail
        army={{
          ...EARLY_ARMY,
          category: TroopType.Crossbowman,
          stamina: { current: 120, max: 120, perExplore: 20 },
          secondsToFull: 0,
        }}
      />,
    ),
  );
  const rangedStrip = host.querySelector("[data-troop-trait-strip]")!;
  expect(rangedStrip.textContent).toContain(COMBAT_MARK_WORDS.bow);
  expect(rangedStrip.textContent).not.toContain(UNIT_DETAILS_WORDS.beastHeadline.bow);
  expect(rangedStrip.textContent).not.toContain(UNIT_DETAILS_WORDS.strikeRule.bow);
  expect(host.textContent).not.toContain("Full in");
});
