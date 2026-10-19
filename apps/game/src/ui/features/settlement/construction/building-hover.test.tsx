// @vitest-environment jsdom
import { GameProvider } from "@/hooks/context/game-context";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { configManager } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { BuildingCard } from "./select-preview-building";

afterEach(() => {
  vi.restoreAllMocks();
  useTooltipStore.setState({ tooltip: null } as never);
  document.body.innerHTML = "";
});

/** A copper mine's rules: two population, and each cycle makes 2 Copper from 1 Wheat, 0.3 Wood and 0.2 Coal. */
const copperRules = () => {
  vi.spyOn(configManager, "getBuildingCategoryConfig").mockReturnValue({ population_cost: 2, capacity_grant: 0 });
  vi.spyOn(configManager, "getRecipeOutput").mockReturnValue(2);
  vi.spyOn(configManager, "getRecipeInputs").mockReturnValue([
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Wood, amount: 0.3 },
    { resource: ResourcesIds.Coal, amount: 0.2 },
  ]);
};

const draw = (node: ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store: frontierDay().store } as unknown as GameClientSetup}
        account={{ address: "0x111" } as never}
      >
        {node}
      </GameProvider>,
    ),
  );
  return host;
};

it("leaves the numbers off the Build card and writes them compactly in its hover", () => {
  copperRules();
  const card = draw(
    <BuildingCard
      buildingId={BuildingType.ResourceCopper}
      buildingName="Copper"
      resource={ResourcesIds.Copper}
      onClick={() => {}}
      active={false}
      entityId={undefined}
      useSimpleCost={false}
      gives="Copper +2/s"
      requirements={[
        { resource: ResourcesIds.Labor, current: 2_834, amount: 66 },
        { resource: ResourcesIds.Wood, current: 50, amount: 66 },
      ]}
    />,
  );
  // The card names the building and offers its actions; what it gives and costs is a hover away.
  expect(card.querySelector(".ui-card__title")?.textContent).toBe("Copper");
  expect(card.querySelector(".ui-card__detail")).toBeNull();
  expect(card.textContent).not.toContain("+2/s");
  expect(card.textContent).not.toContain("you have");

  act(() =>
    card.querySelector('[aria-label="About Copper"]')!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  const tip = useTooltipStore.getState().tooltip?.content as ReactNode;
  const hover = draw(tip);
  const rows = [...hover.querySelectorAll('[aria-label="Build cost"] > li')];
  expect(rows.map((row) => row.textContent)).toEqual(["Labor2,834 / 66", "Wood50 / 66"]);
  expect(rows.map((row) => row.className.includes("text-hud-bad"))).toEqual([false, true]);
  expect(hover.textContent).toContain("Copper");
  expect(hover.textContent).toContain("2 population");
  expect(hover.textContent).toContain("Copper +2/s");
  expect(hover.textContent).toContain("2 Copper from 1 Wheat · 0.3 Wood · 0.2 Coal");
});

it("says a free building is free and leaves out the burn line where production burns nothing", () => {
  vi.spyOn(configManager, "getBuildingCategoryConfig").mockReturnValue({ population_cost: 0, capacity_grant: 6 });
  const card = draw(
    <BuildingCard
      buildingId={BuildingType.WorkersHut}
      buildingName="Workers Hut"
      onClick={() => {}}
      active={false}
      entityId={undefined}
      useSimpleCost={false}
      gives="+6 population cap"
      requirements={[]}
    />,
  );
  act(() =>
    card
      .querySelector('[aria-label="About Workers Hut"]')!
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  const hover = draw(useTooltipStore.getState().tooltip?.content as ReactNode);
  expect(hover.textContent).toBe("Workers Hut+6 population capFree to build");
});
