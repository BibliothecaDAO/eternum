// @vitest-environment node

import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  buildBlitzRealmSuggestions,
  type BlitzBuildingCounts,
  type BlitzRealmSuggestionInput,
} from "./blitz-suggestions";

const buildability: BlitzRealmSuggestionInput["buildability"] = {
  copper: { canBuild: true },
  coal: { canBuild: true },
  military: { canBuild: true },
  wheat: { canBuild: true },
  wood: { canBuild: true },
  workerHut: { canBuild: true },
};

const emptyCounts: BlitzBuildingCounts = {
  copper: 0,
  coal: 0,
  crossbowmanT1: 0,
  knightT1: 0,
  paladinT1: 0,
  wheat: 0,
  wood: 0,
  workerHut: 0,
};

const levelOneBuildout: BlitzBuildingCounts = {
  ...emptyCounts,
  copper: 2,
  coal: 2,
  wheat: 8,
  wood: 2,
};

const baseInput = (overrides: Partial<BlitzRealmSuggestionInput> = {}): BlitzRealmSuggestionInput => ({
  realmId: 101,
  realmName: "Test Realm",
  realmLevel: 1,
  isBlitzActive: true,
  canProvision: false,
  canAffordUpgrade: false,
  hasAvailableBuildingTile: true,
  buildingTilesOccupied: 1,
  buildingCounts: emptyCounts,
  population: 1,
  populationCapacity: 10,
  occupiedGuards: 0,
  maxGuards: 0,
  occupiedExplorers: 0,
  maxExplorers: 0,
  buildability,
  ...overrides,
});

const actionsFor = (input: BlitzRealmSuggestionInput) =>
  buildBlitzRealmSuggestions(input).map((suggestion) => suggestion.action);

describe("buildBlitzRealmSuggestions", () => {
  it("does not suggest anything outside active blitz play", () => {
    expect(buildBlitzRealmSuggestions(baseInput({ isBlitzActive: false }))).toEqual([]);
  });

  it("uses provision as the first step when a fresh realm cannot afford level-up", () => {
    const [first] = buildBlitzRealmSuggestions(baseInput({ canProvision: true, canAffordUpgrade: false }));

    expect(first).toMatchObject({
      action: "provision",
      label: "Provision realm",
      reason: "Start your economy before upgrading.",
    });
  });

  it("bundles provision and level-up only when the upgrade is already affordable", () => {
    const [first] = buildBlitzRealmSuggestions(baseInput({ canProvision: true, canAffordUpgrade: true }));

    expect(first).toMatchObject({
      action: "upgrade-and-provision",
      label: "Provision + level up realm",
      reason: "Start your economy and upgrade in one action.",
    });
  });

  it("only shows the first eligible hint per realm", () => {
    const suggestions = buildBlitzRealmSuggestions(baseInput({ buildingTilesOccupied: 0 }));

    expect(suggestions.map((suggestion) => suggestion.action)).toEqual(["build-wheat"]);
    expect(suggestions[0]).toMatchObject({
      buildingTypeHint: BuildingType.ResourceWheat,
      resourceHint: ResourcesIds.Wheat,
    });
  });

  it("prioritizes worker huts when available population is low", () => {
    const [first] = buildBlitzRealmSuggestions(baseInput({ population: 7, populationCapacity: 10 }));

    expect(first).toMatchObject({
      action: "build-worker-hut",
      buildingTypeHint: BuildingType.WorkersHut,
    });
  });

  it("does not suggest worker huts while more than three population slots remain", () => {
    expect(actionsFor(baseInput({ population: 46, populationCapacity: 54 }))).toEqual(["build-wheat"]);
  });

  it("keeps wood, coal, and copper suggestions in sync without suggesting markets", () => {
    expect(
      actionsFor(
        baseInput({
          buildingCounts: {
            ...emptyCounts,
            wheat: 8,
          },
        }),
      ),
    ).toEqual(["build-wood"]);

    expect(
      actionsFor(
        baseInput({
          buildingCounts: {
            ...emptyCounts,
            wheat: 8,
            wood: 1,
          },
        }),
      ),
    ).toEqual(["build-coal"]);

    expect(
      actionsFor(
        baseInput({
          buildingCounts: {
            ...emptyCounts,
            coal: 1,
            wheat: 8,
            wood: 1,
          },
        }),
      ),
    ).toEqual(["build-copper"]);

    expect(
      actionsFor(
        baseInput({
          realmLevel: 2,
          buildingCounts: {
            ...emptyCounts,
            copper: 1,
            coal: 1,
            wheat: 8,
            wood: 2,
          },
        }),
      ),
    ).toEqual(["build-coal"]);

    expect(
      actionsFor(
        baseInput({
          realmLevel: 2,
          buildingCounts: {
            ...emptyCounts,
            wheat: 8,
            wood: 2,
          },
        }),
      ),
    ).toEqual(["build-coal"]);

    expect(
      actionsFor(
        baseInput({
          buildingCounts: {
            ...levelOneBuildout,
          },
        }),
      ),
    ).toEqual([]);
  });

  it("prioritizes wheat before resource buildings until the realm-level target is met", () => {
    expect(
      actionsFor(
        baseInput({
          buildingCounts: {
            ...emptyCounts,
            wheat: 2,
          },
        }),
      ),
    ).toEqual(["build-wheat"]);
  });

  it("scales the wheat farm target with realm level (2/4/8/12)", () => {
    const wheatReasonAt = (realmLevel: number, wheat: number) =>
      buildBlitzRealmSuggestions(baseInput({ realmLevel, buildingCounts: { ...emptyCounts, wheat } }))[0];

    // Target per level: L0=2, L1=4, L2=8, L3+=12.
    const cases: Array<{ level: number; target: number }> = [
      { level: 0, target: 2 },
      { level: 1, target: 4 },
      { level: 2, target: 8 },
      { level: 3, target: 12 },
      { level: 5, target: 12 }, // clamps to the last entry
    ];

    for (const { level, target } of cases) {
      // One below target -> still suggests wheat, labelled against the level target.
      expect(wheatReasonAt(level, target - 1)).toMatchObject({
        action: "build-wheat",
        reason: `${target - 1}/${target} farms.`,
      });
      // At target -> wheat is satisfied, no longer the top suggestion.
      expect(wheatReasonAt(level, target)?.action).not.toBe("build-wheat");
    }
  });

  it("stops the level-1 wheat target at 4 farms instead of jumping to 8", () => {
    // Regression: at realm level 1, 4 farms completes wheat (was sprinting to 8).
    expect(actionsFor(baseInput({ realmLevel: 1, buildingCounts: { ...emptyCounts, wheat: 4 } }))).not.toContain(
      "build-wheat",
    );
    expect(actionsFor(baseInput({ realmLevel: 1, buildingCounts: { ...emptyCounts, wheat: 3 } }))).toEqual([
      "build-wheat",
    ]);
  });

  it("does not emit build actions when autobuild cannot currently submit them", () => {
    expect(
      buildBlitzRealmSuggestions(
        baseInput({
          hasAvailableBuildingTile: false,
          buildability: {
            copper: { canBuild: false },
            coal: { canBuild: false },
            military: { canBuild: false },
            wheat: { canBuild: false },
            wood: { canBuild: false },
            workerHut: { canBuild: false },
          },
        }),
      ),
    ).toEqual([]);
  });

  it("uses affordable level-ups as the highest-priority realm hint", () => {
    expect(actionsFor(baseInput({ buildingCounts: levelOneBuildout, canAffordUpgrade: false }))).not.toContain(
      "upgrade",
    );

    expect(actionsFor(baseInput({ canAffordUpgrade: true, population: 9, populationCapacity: 10 }))).toEqual([
      "upgrade",
    ]);
  });

  it("targets the recommended T1 military building by realm level", () => {
    expect(
      actionsFor(
        baseInput({
          realmLevel: 2,
          buildingCounts: {
            ...levelOneBuildout,
            copper: 4,
            coal: 4,
            crossbowmanT1: 1,
            wood: 4,
          },
          militaryTarget: {
            buildingType: BuildingType.ResourceCrossbowmanT1,
            count: 1,
            label: "Crossbowman T1",
            resource: ResourcesIds.Crossbowman,
            bonusPercent: 30,
          },
        }),
      ),
    ).toEqual(["build-military"]);

    expect(
      actionsFor(
        baseInput({
          realmLevel: 0,
          buildingCounts: levelOneBuildout,
          militaryTarget: {
            buildingType: BuildingType.ResourceCrossbowmanT1,
            count: 0,
            label: "Crossbowman T1",
            resource: ResourcesIds.Crossbowman,
            bonusPercent: 30,
          },
        }),
      ),
    ).toEqual([]);
  });

  it("suggests deploying explorers (after wheat) until two are on the map", () => {
    // Wheat target met for level 1 (4), explorer slots available, none deployed.
    const [first] = buildBlitzRealmSuggestions(
      baseInput({
        realmLevel: 1,
        buildingCounts: { ...emptyCounts, wheat: 4 },
        maxExplorers: 5,
        occupiedExplorers: 0,
      }),
    );
    expect(first).toMatchObject({ action: "deploy-explorer", reason: "0/2 explorers deployed." });

    // Explorers take priority over resource buildings once wheat is satisfied.
    expect(
      actionsFor(
        baseInput({
          realmLevel: 1,
          buildingCounts: { ...emptyCounts, wheat: 4 },
          maxExplorers: 5,
          occupiedExplorers: 1,
        }),
      ),
    ).toEqual(["deploy-explorer"]);
  });

  it("stops suggesting explorers once two are deployed", () => {
    expect(
      actionsFor(
        baseInput({
          realmLevel: 1,
          buildingCounts: { ...emptyCounts, wheat: 4 },
          maxExplorers: 5,
          occupiedExplorers: 2,
        }),
      ),
    ).not.toContain("deploy-explorer");
  });

  it("does not suggest explorers when the realm has no explorer slots", () => {
    expect(
      actionsFor(
        baseInput({
          realmLevel: 1,
          buildingCounts: { ...emptyCounts, wheat: 4 },
          maxExplorers: 0,
          occupiedExplorers: 0,
        }),
      ),
    ).not.toContain("deploy-explorer");
  });

  it("keeps wheat ahead of explorer deployment when the wheat target is unmet", () => {
    expect(
      actionsFor(
        baseInput({
          realmLevel: 1,
          buildingCounts: { ...emptyCounts, wheat: 2 },
          maxExplorers: 5,
          occupiedExplorers: 0,
        }),
      ),
    ).toEqual(["build-wheat"]);
  });

  it("gates garrison suggestions behind a foundation economy", () => {
    expect(actionsFor(baseInput({ maxGuards: 10 }))).not.toContain("garrison");

    expect(actionsFor(baseInput({ maxGuards: 10, buildingCounts: levelOneBuildout }))).toEqual(["garrison"]);
  });
});
