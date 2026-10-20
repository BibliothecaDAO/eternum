// @vitest-environment jsdom
import { ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

// Every resource's recipe is one Labor, as Blitz's simple production reads it.
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const original = await importOriginal<typeof import("@bibliothecadao/eternum")>();
  const recipe = [{ resource: ResourcesIds.Labor, amount: 1 }];
  return {
    ...original,
    configManager: { isCommandEnabled: () => true, getRecipeInputs: () => recipe, getRecipeOutput: () => 1 },
    aggregateConsumptionPerSecond: () => new Map(),
  };
});

import { RealmAutomationPanel } from "./realm-automation-panel";

const automationOf = (producedResources: ResourcesIds[]) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<RealmAutomationPanel realmEntityId="7" producedResources={producedResources} />));
  const text = host.textContent ?? "";
  act(() => root.unmount());
  host.remove();
  return text;
};

it("tells a realm whose farm and huts produce on their own that there is nothing to automate, not that nothing produces", () => {
  expect(automationOf([ResourcesIds.Wheat, ResourcesIds.Labor])).toBe(
    "Nothing to automate here yet: Wheat and Labor produce on their own. Build a resource building to automate what it makes.",
  );
});

it("offers a resource building's output to automate", () => {
  const text = automationOf([ResourcesIds.Wheat, ResourcesIds.Wood]);
  expect(text).toContain("Production automation");
  expect(text).toContain("Wood");
  expect(text).not.toContain("Nothing to automate");
});
