import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "../managers/config-manager";
import { buildResourceDependencyOrder } from "./production";

// Complex recipes consume the listed inputs; labor recipes consume nothing, so the order follows the complex graph.
const recipes = (inputs: Partial<Record<ResourcesIds, ResourcesIds[]>>) =>
  vi
    .spyOn(configManager, "getRecipeInputs")
    .mockImplementation((resource, simple) =>
      simple ? [] : (inputs[resource] ?? []).map((input) => ({ resource: input, amount: 1 })),
    );

describe("buildResourceDependencyOrder", () => {
  afterEach(() => vi.restoreAllMocks());

  it("orders inputs before the resources that consume them", () => {
    recipes({ [ResourcesIds.Knight]: [ResourcesIds.Copper], [ResourcesIds.Copper]: [ResourcesIds.Wood] });
    expect(
      buildResourceDependencyOrder([ResourcesIds.Knight, ResourcesIds.Copper, ResourcesIds.Wood], "realm"),
    ).toEqual([ResourcesIds.Wood, ResourcesIds.Copper, ResourcesIds.Knight]);
  });

  it("orders the Blitz recipe cycle deterministically and keeps troops after their inputs", () => {
    // Coal, Wood and Copper each consume the other two; troops consume Copper.
    recipes({
      [ResourcesIds.Coal]: [ResourcesIds.Wood, ResourcesIds.Copper],
      [ResourcesIds.Wood]: [ResourcesIds.Coal, ResourcesIds.Copper],
      [ResourcesIds.Copper]: [ResourcesIds.Wood, ResourcesIds.Coal],
      [ResourcesIds.Paladin]: [ResourcesIds.Copper],
      [ResourcesIds.Knight]: [ResourcesIds.Copper],
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const order = buildResourceDependencyOrder(
      [ResourcesIds.Paladin, ResourcesIds.Copper, ResourcesIds.Knight, ResourcesIds.Wood, ResourcesIds.Coal],
      "realm",
    );
    expect(order).toHaveLength(5);
    expect(order.indexOf(ResourcesIds.Copper)).toBeLessThan(order.indexOf(ResourcesIds.Knight));
    expect(order.indexOf(ResourcesIds.Copper)).toBeLessThan(order.indexOf(ResourcesIds.Paladin));
    expect(order.slice(0, 3).sort((a, b) => a - b)).toEqual([
      ResourcesIds.Coal,
      ResourcesIds.Wood,
      ResourcesIds.Copper,
    ]);
    expect(order[0]).toBe(ResourcesIds.Coal);
    expect(warn).not.toHaveBeenCalled();
  });
});
