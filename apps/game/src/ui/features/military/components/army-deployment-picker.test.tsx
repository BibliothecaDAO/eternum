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
    expect(host.querySelector('[aria-pressed="true"]')?.getAttribute("aria-label")).toMatch(/^Knight T1: /);
    act(() => root.unmount());
    host.remove();
  });

  it("chooses the amount in one row, with the cost on Deploy and one reason under it when it cannot go", () => {
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

    // The amount: one field, out of the 420 knights on hand, and Max; no quick-add buttons, no line repeating it.
    expect(host.textContent).toContain("of 420");
    expect(host.textContent).not.toMatch(/Uses \d/);
    expect(button(/^\+\d/)).toBeUndefined();
    act(() => button(/^Max$/).click());
    expect(field().value).toBe("420");
    // Each knight takes two wheat: the cost rides on the one primary button.
    expect(button(/^Deploy/).textContent).toBe("Deploy · 840 wheat");
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
