// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { EARLY_ARMY } from "../research/progression-fixture";
import { type ArmyDetailFacts, readArmyDetail } from "./army-detail";
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

/** The panel's level-ups for an army, with one attribute chosen: the foot's line under the verb. */
const footFor = (army: ArmyDetailFacts, attribute: string) => {
  act(() =>
    root.render(<ArmyDetail army={readArmyDetail(army)} sending={false} choosing onLevelUp={() => undefined} />),
  );
  act(() => host.querySelector<HTMLButtonElement>(`[data-attribute="${attribute}"]`)!.click());
  return host.textContent;
};

// buy_tier writes the new level first, then refills up to 30 under the maximum that level gives (relics.cairo).
it.each([
  [120, 20],
  [119, 21],
  [90, 30],
])("previews buying uncommon Logistics at %s/120 with the %s stamina it refills under 140", (current, refill) => {
  expect(footFor({ ...EARLY_ARMY, xp: 100, stamina: { current, max: 120, perExplore: 20 } }, "logistics")).toContain(
    `100 XP · refills ${refill} stamina`,
  );
});

it("refills under a later Logistics level's raised maximum: rare from 140/140 refills 30, not nothing", () => {
  const uncommon: ArmyDetailFacts = {
    ...EARLY_ARMY,
    xp: 200,
    stamina: { current: 140, max: 140, perExplore: 20 },
    progress: { ...EARLY_ARMY.progress, logistics: 2 },
  };
  expect(footFor(uncommon, "logistics")).toContain("200 XP · refills 30 stamina");
});

it("refills nothing for a full army buying any other attribute, whose maximum it does not raise", () => {
  const full = { ...EARLY_ARMY, xp: 100, stamina: { current: 120, max: 120, perExplore: 20 } };
  expect(readArmyDetail(full).refill).toBe(0);
  expect(footFor(full, "battle")).toContain("100 XP · refills 0 stamina");
});

it("reads on its first step when the stamina is full again and what each tile explored sends home", () => {
  act(() => root.render(<ArmyDetail army={readArmyDetail(EARLY_ARMY)} sending={false} onLevelUp={() => undefined} />));
  const stats = host.querySelector('[data-army-step="stats"]')!;
  expect(stats.textContent).toContain("Full in 4h");
  expect(stats.textContent).toContain("+75 a tile");

  // A full army in a game whose reveals pay nothing reads neither.
  act(() =>
    root.render(
      <ArmyDetail
        army={readArmyDetail({
          ...EARLY_ARMY,
          stamina: { current: 120, max: 120, perExplore: 20 },
          secondsToFull: 0,
          revealYield: null,
        })}
        sending={false}
        onLevelUp={() => undefined}
      />,
    ),
  );
  expect(host.textContent).not.toContain("Full in");
  expect(host.textContent).not.toMatch(/\+\S+ a tile/);
});

it("reads its stamina on one line: 18/140, a bar of one segment per explore's 20 stamina, and when it is full", () => {
  // The owner's army (26 October): 18 of 140 stamina, one explore costing 20; layout A (27 October).
  const army = { ...EARLY_ARMY, stamina: { current: 18, max: 140, perExplore: 20 } };
  act(() =>
    root.render(
      <ArmyDetail
        army={readArmyDetail(army)}
        refill={<button type="button">Refill</button>}
        sending={false}
        onLevelUp={() => undefined}
      />,
    ),
  );
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
