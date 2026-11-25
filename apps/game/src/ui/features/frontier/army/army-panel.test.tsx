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
it("reads the troops, when the stamina is full again and the stamina over one unbroken bar with its value", () => {
  act(() => root.render(<ArmyDetail army={{ ...EARLY_ARMY, stamina: { current: 18, max: 140, perExplore: 20 } }} />));
  const stats = host.querySelector('[data-army-step="stats"]')!;
  expect(stats.querySelector('[aria-label="1,500 troops"]')?.textContent).toBe("1,500");
  expect(stats.querySelector('[aria-label="1,500 troops"]')?.children).toHaveLength(0);
  expect(stats.textContent).toContain("Full in 4h");
  const meter = host.querySelector('[role="meter"][aria-label="stamina"]')!;
  expect([meter.getAttribute("aria-valuenow"), meter.getAttribute("aria-valuemax")]).toEqual(["18", "140"]);
  expect([...meter.querySelectorAll<HTMLElement>("i")].map((fill) => fill.style.width)).toEqual([
    `${(18 / 140) * 100}%`,
  ]);
  expect(meter.closest("[data-stamina-line]")!.textContent).toBe("18 / 140");

  act(() =>
    root.render(
      <ArmyDetail army={{ ...EARLY_ARMY, stamina: { current: 120, max: 120, perExplore: 20 }, secondsToFull: 0 }} />,
    ),
  );
  expect(host.textContent).not.toContain("Full in");
});
