import { researchRowCategory } from "@bibliothecadao/eternum";
import { getProducedResource, ResourcesIds } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { FRONTIER_STORES, MADE_STORES, storeBuilding, storeMadeBy } from "./stores";

it("holds each made store to the building the game says makes it", () => {
  expect(MADE_STORES.map((kind) => [kind, getProducedResource(storeBuilding(kind))])).toEqual(
    MADE_STORES.map((kind) => [kind, FRONTIER_STORES[kind].resource]),
  );
});

it("gives every Frontier building that makes a stored resource its store, so none is left without a card", () => {
  const makers = Object.values(researchRowCategory).filter(
    (category): category is number => category !== undefined && getProducedResource(category) !== undefined,
  );
  expect(makers.length).toBeGreaterThan(0);
  for (const category of makers) expect(storeMadeBy(category), `building ${category}`).toBeDefined();
  expect(FRONTIER_STORES.troops.resource).toBe(ResourcesIds.Knight);
});
