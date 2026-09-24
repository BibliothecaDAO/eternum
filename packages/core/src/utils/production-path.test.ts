import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";

import blitz from "../../../../config/generated/blitz.madara.json";
import duel from "../../../../config/generated/duel.madara.json";
import eternum from "../../../../config/generated/eternum.madara.json";
import frontier from "../../../../config/generated/frontier.madara.json";
import { nativePresetForId, nativePresetIdFor } from "../../../../config/source/native";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { hasEnabledProductionPath } from "./production-path";

type GeneratedPreset = {
  configuration: {
    resources: Record<"productionByComplexRecipe" | "productionBySimpleRecipe", Record<string, unknown[]>>;
  };
};

const games = { frontier, blitz, duel, eternum } as const;

/** A resource's production path as the game's generated recipes and its registered command mask give it. */
const canRefill = (game: keyof typeof games, resource: ResourcesIds) => {
  const { resources } = (games[game] as GeneratedPreset).configuration;
  const mask = nativePresetForId(nativePresetIdFor(game)).commandMask;
  const enabled = (command: keyof typeof nativeCommandBits) => (mask & BigInt(nativeCommandBits[command])) !== 0n;
  return hasEnabledProductionPath(
    {
      simple_inputs: resources.productionBySimpleRecipe[resource] ?? [],
      complex_inputs: resources.productionByComplexRecipe[resource] ?? [],
    },
    { labor: enabled("BurnLaborForResourceProduction"), resource: enabled("BurnResourceForResourceProduction") },
  );
};

describe("production path", () => {
  it.each(Object.keys(games) as (keyof typeof games)[])("gives Labor no production path in %s", (game) => {
    expect(canRefill(game, ResourcesIds.Labor)).toBe(false);
  });

  it("keeps a resource whose recipe is on an enabled path, and drops it where the mask disables every path", () => {
    expect(canRefill("blitz", ResourcesIds.Wood)).toBe(true);
    expect(canRefill("duel", ResourcesIds.Wood)).toBe(true);
    expect(canRefill("eternum", ResourcesIds.Wood)).toBe(true);
    expect(canRefill("frontier", ResourcesIds.Knight)).toBe(false);
  });

  it("reads each path only where the mask enables it", () => {
    const labor = { simple_inputs: [1], complex_inputs: [] };
    expect(hasEnabledProductionPath(labor, { labor: false, resource: true })).toBe(false);
    expect(hasEnabledProductionPath(labor, { labor: true, resource: false })).toBe(true);
    expect(hasEnabledProductionPath(undefined, { labor: true, resource: true })).toBe(false);
  });
});
