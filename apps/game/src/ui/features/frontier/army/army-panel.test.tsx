// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { EARLY_ARMY } from "../research/progression-fixture";
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
it("reads on its first step when the stamina is full again and what each tile explored sends home", () => {
  act(() => root.render(<ArmyDetail army={EARLY_ARMY} />));
  const stats = host.querySelector('[data-army-step="stats"]')!;
  expect(stats.textContent).toContain("Full in 4h");
  expect(stats.textContent).toContain("+75 a tile");
  // A reveal pays one of the two, as the contract draws it: its chip's name says "or", and "a tile" once.
  expect(stats.querySelector('[aria-label^="Essence"]')!.getAttribute("aria-label")).toBe(
    "Essence or Labor, +75 a tile",
  );

  // A full army in a game whose reveals pay nothing reads neither.
  act(() =>
    root.render(
      <ArmyDetail
        army={{
          ...EARLY_ARMY,
          stamina: { current: 120, max: 120, perExplore: 20 },
          secondsToFull: 0,
          revealYield: null,
        }}
      />,
    ),
  );
  expect(host.textContent).not.toContain("Full in");
  expect(host.textContent).not.toMatch(/\+\S+ a tile/);
});
it("reads its stamina on one row: its word, 18/140 and when it is full, over one unbroken bar", () => {
  const army = { ...EARLY_ARMY, title: "Knights", stamina: { current: 18, max: 140, perExplore: 20 } };
  act(() => root.render(<ArmyDetail army={army} />));
  const meter = host.querySelector('[role="meter"][aria-label="stamina"]')!;
  expect([meter.getAttribute("aria-valuenow"), meter.getAttribute("aria-valuemax")]).toEqual(["18", "140"]);
  const fills = [...meter.querySelectorAll<HTMLElement>("i")].map((fill) => fill.style.width);
  expect(fills).toEqual([`${(18 / 140) * 100}%`]);
  expect(meter.closest("[data-stamina-line]")!.textContent).toBe("Stamina18/140Full in 4h");
  expect(host.querySelector(".army-detail__title")?.textContent).toBe("Knights");
  expect(host.querySelector(".army-detail__sub")?.textContent).toMatch(/troops.*\+75 a tile$/);
});
