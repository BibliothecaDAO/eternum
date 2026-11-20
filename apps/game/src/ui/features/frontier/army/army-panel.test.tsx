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
it("reads its stamina on one line: 18/140, a bar of one segment per explore's 20 stamina, and when it is full", () => {
  // The owner's army (26 October): 18 of 140 stamina, one explore costing 20; layout A (27 October).
  const army = { ...EARLY_ARMY, stamina: { current: 18, max: 140, perExplore: 20 } };
  act(() => root.render(<ArmyDetail army={army} refill={<button type="button">Refill</button>} />));
  const meter = host.querySelector('[role="meter"][aria-label="stamina"]')!;
  expect([meter.getAttribute("aria-valuenow"), meter.getAttribute("aria-valuemax")]).toEqual(["18", "140"]);
  const fills = [...meter.querySelectorAll<HTMLElement>(".ui-meter > i")].map((fill) => fill.style.width);
  expect(fills).toEqual(["90%", "0%", "0%", "0%", "0%", "0%", "0%"]);

  const line = meter.closest("[data-stamina-line]")!;
  expect(line.textContent).toBe("18/140Full in 4h");
  // The row over it holds the troops, what a tile sends home and the refill, so the line keeps its width.
  const over = line.previousElementSibling!;
  expect(over.textContent).toMatch(/\+75 a tile.*Refill$/);
  expect(over.textContent).not.toMatch(/18\/140|Full in/);
});
