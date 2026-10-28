// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => [] }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
  useCurrentBlockTimestamp: () => 350,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { ArmyDeploymentPicker } from "./army-deployment-picker";

afterEach(() => setBlockTimestampSource(null));

describe("the shared deployment picker", () => {
  it("opens on the troop the structure holds, in a game that raises no crossbowmen", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // A realm holding only knights, on a board whose recipes raise only knights.
    const { store } = frontierDay();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ArmyDeploymentPicker structureId={7} isExplorer />
        </GameProvider>,
      ),
    );
    expect(host.querySelector('[aria-pressed="true"]')?.getAttribute("aria-label")).toMatch(/^Knight T1, /);
    act(() => root.unmount());
    host.remove();
  });

  it("draws a column per troop under its name, every tier in place from T1 down", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store } = frontierDay();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ArmyDeploymentPicker structureId={7} isExplorer />
        </GameProvider>,
      ),
    );
    const columns = [...host.querySelectorAll(".ui-deploy__troop")];
    // The troop catalog's order (TROOP_TYPES), the one every list of troops follows.
    expect(columns.map((column) => column.querySelector(".ui-deploy__name")?.textContent)).toEqual([
      "Knight",
      "Crossbow",
      "Paladin",
    ]);
    // Each column holds its troop's tiers, T1 first, an empty one shut and saying so.
    expect(
      columns.map((column) =>
        [...column.querySelectorAll("button")].map((stack) => [stack.getAttribute("aria-label"), stack.disabled]),
      ),
    ).toEqual([
      [
        ["Knight T1, 420 held", false],
        ["Knight T2, 0 held", true],
        ["Knight T3, 0 held", true],
      ],
      [
        ["Crossbow T1, 0 held", true],
        ["Crossbow T2, 0 held", true],
        ["Crossbow T3, 0 held", true],
      ],
      [
        ["Paladin T1, 0 held", true],
        ["Paladin T2, 0 held", true],
        ["Paladin T3, 0 held", true],
      ],
    ]);
    act(() => root.unmount());
    host.remove();
  });

  it("chooses the amount in one row, with the cost beside Deploy and one reason under it when it cannot go", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store } = frontierDay();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ArmyDeploymentPicker structureId={7} isExplorer />
        </GameProvider>,
      ),
    );
    const button = (text: RegExp) => [...host.querySelectorAll("button")].find((each) => text.test(each.textContent!))!;
    const field = () => host.querySelector<HTMLInputElement>('input[inputmode="numeric"]')!;

    // The amount: one field, out of the 420 knights on hand, and Max; no line repeating it, and no +500, which would
    // only be Max.
    expect(host.textContent).toContain("of 420");
    expect(host.textContent).not.toMatch(/Uses \d/);
    expect(button(/^\+500$/)).toBeUndefined();
    act(() => button(/^Max$/).click());
    expect(field().value).toBe("420");
    expect(button(/^Max$/).disabled).toBe(true);
    // Each knight takes two wheat: the cost is the line beside the one primary button in the window's foot, never on it.
    expect(button(/^Deploy/).closest(".ui-window__foot")).not.toBeNull();
    expect(button(/^Deploy/).textContent).toBe("Deploy");
    expect(host.querySelector(".ui-window__foot .ui-cost")?.textContent).toBe("840 wheat");
    // This fixture's realm has no map position, so no spawn hex: Deploy is shut and says so, once.
    expect(button(/^Deploy/).disabled).toBe(true);
    expect([...host.querySelectorAll('[role="status"]')].map((line) => line.textContent)).toEqual([
      "No free spawn hex.",
    ]);

    // The realm's last knights gone: nothing to send, so the field and Max shut, and still a single reason line.
    act(() =>
      store.applyFacts([
        {
          model: "ResourceBalance",
          key: "0x8",
          value: { game_id: 1, entity_id: 7, resource_type: 26, balance: "0" },
        },
      ] as never),
    );
    expect(host.textContent).toContain("of 0");
    expect(field().disabled).toBe(true);
    expect(button(/^Max$/).disabled).toBe(true);
    expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
    act(() => root.unmount());
    host.remove();
  });
});

/** Types into a mounted field as a player does, the field's own input event included. */
const typeInto = (input: HTMLInputElement, text: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

describe("the picker's typed troop count", () => {
  it("keeps the number the player typed, as the old count did: its sign, its whole part, at most what is on hand", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store } = frontierDay();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ArmyDeploymentPicker structureId={7} isExplorer />
        </GameProvider>,
      ),
    );
    const count = () => host.querySelector<HTMLInputElement>('input[aria-label="Knight T1"]')!;
    // The fixture realm holds 420 knights.
    for (const [text, shown] of [
      ["-500", "0"],
      ["1.5", "1"],
      ["1,200", "420"],
      ["250", "250"],
    ] as const) {
      typeInto(count(), text);
      expect(count().value, text).toBe(shown);
    }
    act(() => root.unmount());
    host.remove();
  });
});
