// @vitest-environment node

import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { buildBlitzRealmSuggestions, type BlitzRealmSuggestionInput } from "./blitz-suggestions";

const buildability = {
  copper: { canBuild: true },
  coal: { canBuild: true },
  market: { canBuild: true },
  wheat: { canBuild: true },
  wood: { canBuild: true },
  workerHut: { canBuild: true },
};

const baseInput = (overrides: Partial<BlitzRealmSuggestionInput> = {}): BlitzRealmSuggestionInput => ({
  realmId: 101,
  realmName: "Test Realm",
  isBlitzActive: true,
  canProvision: false,
  canAffordUpgrade: false,
  hasAvailableBuildingTile: true,
  buildingTilesOccupied: 1,
  buildingCounts: {
    copper: 0,
    coal: 0,
    market: 0,
    wheat: 0,
    wood: 0,
    workerHut: 0,
  },
  population: 1,
  populationCapacity: 10,
  occupiedGuards: 0,
  maxGuards: 0,
  buildability,
  ...overrides,
});

const actionsFor = (input: BlitzRealmSuggestionInput) =>
  buildBlitzRealmSuggestions(input).map((suggestion) => suggestion.action);

describe("buildBlitzRealmSuggestions", () => {
  it("does not suggest anything outside active blitz play", () => {
    expect(buildBlitzRealmSuggestions(baseInput({ isBlitzActive: false }))).toEqual([]);
  });

  it("uses provision as the only first step for fresh realms", () => {
    expect(actionsFor(baseInput({ canProvision: true, canAffordUpgrade: true }))).toEqual(["provision"]);
  });

  it("starts empty realms with concrete wheat and wood autobuild targets", () => {
    const suggestions = buildBlitzRealmSuggestions(baseInput({ buildingTilesOccupied: 0 }));

    expect(suggestions.map((suggestion) => suggestion.action)).toEqual(["build-wheat", "build-wood"]);
    expect(suggestions[0]).toMatchObject({
      buildingTypeHint: BuildingType.ResourceWheat,
      resourceHint: ResourcesIds.Wheat,
    });
  });

  it("unlocks coal, copper, and market suggestions only after their foundation dependencies", () => {
    expect(
      actionsFor(
        baseInput({
          buildingCounts: {
            copper: 0,
            coal: 0,
            market: 0,
            wheat: 2,
            wood: 1,
            workerHut: 0,
          },
        }),
      ),
    ).toEqual(["build-coal", "build-market"]);

    expect(
      actionsFor(
        baseInput({
          buildingCounts: {
            copper: 0,
            coal: 1,
            market: 0,
            wheat: 2,
            wood: 1,
            workerHut: 0,
          },
        }),
      ),
    ).toEqual(["build-copper", "build-market"]);
  });

  it("prioritizes worker huts when population is pressured", () => {
    const [first] = buildBlitzRealmSuggestions(baseInput({ population: 7, populationCapacity: 10 }));

    expect(first).toMatchObject({
      action: "build-worker-hut",
      buildingTypeHint: BuildingType.WorkersHut,
    });
  });

  it("does not emit build actions when autobuild cannot currently submit them", () => {
    expect(
      buildBlitzRealmSuggestions(
        baseInput({
          hasAvailableBuildingTile: false,
          buildability: {
            copper: { canBuild: false },
            coal: { canBuild: false },
            market: { canBuild: false },
            wheat: { canBuild: false },
            wood: { canBuild: false },
            workerHut: { canBuild: false },
          },
        }),
      ),
    ).toEqual([]);
  });

  it("suggests level-ups only when the upgrade is affordable", () => {
    const foundation = {
      copper: 1,
      coal: 1,
      market: 1,
      wheat: 8,
      wood: 9,
      workerHut: 0,
    };

    expect(actionsFor(baseInput({ buildingCounts: foundation, canAffordUpgrade: false }))).not.toContain("upgrade");
    expect(actionsFor(baseInput({ buildingCounts: foundation, canAffordUpgrade: true }))).toContain("upgrade");
  });

  it("gates garrison suggestions behind a foundation economy", () => {
    expect(actionsFor(baseInput({ maxGuards: 10 }))).not.toContain("garrison");

    expect(
      actionsFor(
        baseInput({
          maxGuards: 10,
          buildingCounts: {
            copper: 1,
            coal: 1,
            market: 1,
            wheat: 8,
            wood: 9,
            workerHut: 0,
          },
        }),
      ),
    ).toContain("garrison");
  });
});
