import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "../managers/config-manager";
import { buildResourceDependencyOrder } from "./production";

const recipes = (inputs: Partial<Record<ResourcesIds, ResourcesIds[]>>) =>
  Object.fromEntries(
    Object.entries(inputs).map(([resource, from]) => [
      resource,
      (from ?? []).map((input) => ({ resource: input, amount: 1 })),
    ]),
  );

describe("buildResourceDependencyOrder", () => {
  afterEach(() => vi.restoreAllMocks());

  it("orders inputs before the resources that consume them", () => {
    vi.spyOn(configManager, "complexSystemResourceInputs", "get").mockReturnValue(
      recipes({ [ResourcesIds.Knight]: [ResourcesIds.Copper], [ResourcesIds.Copper]: [ResourcesIds.Wood] }),
    );
    vi.spyOn(configManager, "getLaborConfig").mockReturnValue({ inputResources: [] } as never);
    expect(
      buildResourceDependencyOrder([ResourcesIds.Knight, ResourcesIds.Copper, ResourcesIds.Wood], "realm"),
    ).toEqual([ResourcesIds.Wood, ResourcesIds.Copper, ResourcesIds.Knight]);
  });

  it("orders the Blitz recipe cycle deterministically and keeps troops after their inputs", () => {
    // Coal, Wood and Copper each consume the other two; troops consume Copper.
    vi.spyOn(configManager, "complexSystemResourceInputs", "get").mockReturnValue(
      recipes({
        [ResourcesIds.Coal]: [ResourcesIds.Wood, ResourcesIds.Copper],
        [ResourcesIds.Wood]: [ResourcesIds.Coal, ResourcesIds.Copper],
        [ResourcesIds.Copper]: [ResourcesIds.Wood, ResourcesIds.Coal],
        [ResourcesIds.Paladin]: [ResourcesIds.Copper],
        [ResourcesIds.Knight]: [ResourcesIds.Copper],
      }),
    );
    vi.spyOn(configManager, "getLaborConfig").mockReturnValue({ inputResources: [] } as never);
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
