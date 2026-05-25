import { ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { createProductionSortComparator, type ProductionSortItem } from "./production-sort";

const item = (resourceId: ResourcesIds, isProducing: boolean): ProductionSortItem => ({
  resourceId,
  isProducing,
});

describe("createProductionSortComparator", () => {
  it("puts starving resources before idle and producing", () => {
    const starved = new Map<ResourcesIds, string>([[ResourcesIds.Wood, "out of donkeys"]]);
    const sorted = [
      item(ResourcesIds.Coal, true),
      item(ResourcesIds.Wood, true),
      item(ResourcesIds.Stone, false),
    ].toSorted(createProductionSortComparator(starved));

    expect(sorted.map((s) => s.resourceId)).toEqual([ResourcesIds.Wood, ResourcesIds.Stone, ResourcesIds.Coal]);
  });

  it("puts idle resources before producing ones within the same starvation bucket", () => {
    const sorted = [
      item(ResourcesIds.Coal, true),
      item(ResourcesIds.Stone, false),
      item(ResourcesIds.Copper, true),
    ].toSorted(createProductionSortComparator());

    expect(sorted.map((s) => s.resourceId)).toEqual([ResourcesIds.Stone, ResourcesIds.Coal, ResourcesIds.Copper]);
  });

  it("pins Wheat first within a bucket and then sorts by ascending resourceId", () => {
    const sorted = [
      item(ResourcesIds.Stone, true),
      item(ResourcesIds.Coal, true),
      item(ResourcesIds.Wheat, true),
    ].toSorted(createProductionSortComparator());

    expect(sorted.map((s) => s.resourceId)).toEqual([ResourcesIds.Wheat, ResourcesIds.Stone, ResourcesIds.Coal]);
  });

  it("ranks idle over producing inside the starving bucket, then Wheat-pins within the producing sub-bucket", () => {
    const starved = new Map<ResourcesIds, string>([
      [ResourcesIds.Wheat, "low seed"],
      [ResourcesIds.Stone, "needs labor"],
    ]);
    const sorted = [
      item(ResourcesIds.Stone, false),
      item(ResourcesIds.Wheat, true),
      item(ResourcesIds.Coal, true),
    ].toSorted(createProductionSortComparator(starved));

    expect(sorted.map((s) => s.resourceId)).toEqual([ResourcesIds.Stone, ResourcesIds.Wheat, ResourcesIds.Coal]);
  });
});
