// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { learnResearch } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

import bindings from "../../../../../../../contracts/l3/world-native/schema/bindings.json";

import { EARLY_ARMY, VETERAN_ARMY } from "../research/progression-fixture";
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

it.each([
  [120, 20],
  [119, 20],
  [90, 20],
])("previews Common Logistics at %s/120 with +%s stamina", (current, refill) => {
  const army = { ...EARLY_ARMY, xp: 100, points: [1, 0, 0, 0, 0], stamina: { current, max: 120, perExplore: 20 } };
  footFor(army, "logistics");
  expect(readArmyDetail(army).attributes.find(({ key }) => key === "logistics")?.next).toMatchObject({
    point: 1,
    refill,
  });
  expect(host.textContent).toContain(`+${refill}`);
});

it("uses the lowest fitting point and clamps its refill to the new Logistics maximum", () => {
  const army = {
    ...EARLY_ARMY,
    points: [1, 0, 1, 1, 0],
    progress: { ...EARLY_ARMY.progress, logistics: 1 },
    stamina: { current: 140, max: 140, perExplore: 20 },
  };
  expect(readArmyDetail(army).attributes.find(({ key }) => key === "logistics")?.next).toMatchObject({
    point: 3,
    tier: 2,
    refill: 25,
  });
});

it("spends the selected point on Stamina, doubles its refill and prevents wasting it on a full bar", () => {
  const spent = vi.fn();
  const army = { ...EARLY_ARMY, points: [1, 0, 1, 0, 0], stamina: { current: 30, max: 120, perExplore: 20 } };
  act(() => root.render(<ArmyDetail army={readArmyDetail(army)} sending={false} choosing onLevelUp={spent} />));
  act(() => host.querySelector<HTMLButtonElement>('[data-attribute="stamina"]')!.click());
  act(() => host.querySelector<HTMLButtonElement>('[aria-label="Spend III point"]')!.click());
  const refill = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Refill")!;
  expect(host.textContent).toContain("+80");
  act(() => refill().click());
  expect(spent).toHaveBeenCalledWith({ kind: "Stamina", value: 3 });
  act(() =>
    root.render(
      <ArmyDetail
        army={readArmyDetail({ ...army, stamina: { ...army.stamina, current: 120 } })}
        sending={false}
        choosing
        onLevelUp={spent}
      />,
    ),
  );
  expect(refill().disabled).toBe(true);
  act(() => host.querySelector<HTMLButtonElement>('[data-attribute="battle"]')!.click());
  expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Level up")!.disabled).toBe(
    false,
  );
});

it("shows empty sockets and the inventory beside a cumulative XP milestone", () => {
  act(() => root.render(<ArmyDetail army={readArmyDetail(EARLY_ARMY)} sending={false} onLevelUp={vi.fn()} />));
  expect(host.querySelectorAll('.ui-tier[data-tier="0"]')).toHaveLength(4);
  expect(host.querySelector('[aria-label="Skill points"]')!.textContent).toBe("I0II0III0IV0V0");
  expect(host.textContent).toContain("12 / 75 XP");
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

const variants = (name: string) =>
  bindings.commandAbi.find((item) => item.name === `world_native::progression::${name}`)!.variants!;

it("offers and submits every skill-point use and Scouting kind in the generated command catalog", () => {
  const spent = vi.fn();
  const army = readArmyDetail({ ...VETERAN_ARMY, points: [1, 1, 1, 1, 1] });
  act(() => root.render(<ArmyDetail army={army} sending={false} choosing onLevelUp={spent} />));
  const uses = variants("SkillPointUse");
  expect([...host.querySelectorAll("[data-attribute]")].map((button) => button.getAttribute("data-attribute"))).toEqual(
    uses.map(({ name }) => name.toLowerCase()),
  );
  const submit = () =>
    act(() =>
      [...host.querySelectorAll("button")]
        .find((button) => /^(Level up|Refill)$/.test(button.textContent ?? ""))!
        .click(),
    );
  for (const { name } of uses) {
    act(() => host.querySelector<HTMLButtonElement>(`[data-attribute="${name.toLowerCase()}"]`)!.click());
    if (name === "Scouting") {
      const kinds = variants("ScoutingKind");
      expect(
        [...host.querySelectorAll("[data-scout-kind]")].map((button) => button.getAttribute("data-scout-kind")),
      ).toEqual(["rift", "camp", "sanctuaries"]);
      expect(
        new Set(
          [...host.querySelectorAll("[data-scout-kind]")].map((button) => button.getAttribute("data-scout-kind")),
        ),
      ).toEqual(new Set(kinds.map(({ name }) => name.toLowerCase())));
      for (const kind of kinds) {
        act(() => host.querySelector<HTMLButtonElement>(`[data-scout-kind="${kind.name.toLowerCase()}"]`)!.click());
        submit();
        expect(spent).toHaveBeenLastCalledWith({ kind: name, value: { kind: kind.name, value: undefined } });
      }
    } else {
      submit();
      expect(spent).toHaveBeenLastCalledWith({ kind: name, value: name === "Stamina" ? 1 : undefined });
    }
  }
  expect(spent).toHaveBeenCalledTimes(uses.length - 1 + variants("ScoutingKind").length);
});

it.each([0n, learnResearch(0n, research.ROW_SHRINE, 0), learnResearch(0n, research.ROW_WELL, 0)])(
  "offers Sanctuaries only after either site unlock and submits its command (%s)",
  (learned) => {
    const spent = vi.fn();
    const army = readArmyDetail({ ...EARLY_ARMY, learned, points: [1, 0, 0, 0, 0] });
    act(() => root.render(<ArmyDetail army={army} sending={false} choosing onLevelUp={spent} />));
    act(() => host.querySelector<HTMLButtonElement>('[data-attribute="scouting"]')!.click());
    expect(host.querySelector('[data-scout-kind="beasts"]')).toBeNull();
    const button = host.querySelector<HTMLButtonElement>('[data-scout-kind="sanctuaries"]');
    expect(Boolean(button)).toBe(learned !== 0n);
    if (!button) return;
    expect(button.textContent).toBe("Sanctuaries");
    expect([...button.querySelectorAll("img")].map((icon) => icon.dataset.icon)).toEqual(["shrine", "well"]);
    act(() => button.click());
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Level up")!.click());
    expect(spent).toHaveBeenCalledOnce();
    expect(spent).toHaveBeenCalledWith({ kind: "Scouting", value: { kind: "Sanctuaries", value: undefined } });
  },
);
