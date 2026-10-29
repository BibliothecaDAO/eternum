import { describe, expect, it, vi } from "vitest";
import {
  buildingEntrance,
  buildingKey,
  isTierChange,
  reconcileBuildingUpdate,
  resolveBuildingInstanceAction,
  type PositionedBuilding,
} from "./hexception-building-reconciliation";

interface TestBuilding extends PositionedBuilding {
  category: number;
}

function createHarness(initialBuildings: TestBuilding[] = []) {
  const storedBuildings = new Map(initialBuildings.map((building) => [buildingKey(building), building]));
  let projectedBuildings = [...initialBuildings];
  const applyBuildingInstance = vi.fn();
  const rebuildTerrainMatrices = vi.fn();
  const reportMissingIdentity = vi.fn();

  const publish = (innerCol?: number, innerRow?: number) => {
    reconcileBuildingUpdate({
      applyFullFallback: () => {
        projectedBuildings = [...storedBuildings.values()];
        rebuildTerrainMatrices();
      },
      applyTargeted: (reconciliation) => {
        projectedBuildings = reconciliation.buildings;
        applyBuildingInstance(reconciliation);
      },
      buildings: projectedBuildings,
      reportMissingIdentity,
      resolveBuilding: (position) => storedBuildings.get(buildingKey(position)),
      update: { innerCol, innerRow },
    });
  };

  const expectProjectionMatchesStore = () => {
    const normalize = (buildings: Iterable<TestBuilding>) =>
      [...buildings].toSorted((left, right) => buildingKey(left).localeCompare(buildingKey(right)));
    expect(normalize(projectedBuildings)).toEqual(normalize(storedBuildings.values()));
  };

  return {
    applyBuildingInstance,
    create(building: TestBuilding) {
      storedBuildings.set(buildingKey(building), building);
      publish(building.col, building.row);
    },
    echo(building: TestBuilding) {
      storedBuildings.set(buildingKey(building), building);
      publish(building.col, building.row);
    },
    expectProjectionMatchesStore,
    publish,
    rebuildTerrainMatrices,
    remove(position: PositionedBuilding) {
      storedBuildings.delete(buildingKey(position));
      publish(position.col, position.row);
    },
    replace(building: TestBuilding) {
      storedBuildings.set(buildingKey(building), building);
      publish(building.col, building.row);
    },
    reportMissingIdentity,
  };
}

describe("hexception building reconciliation", () => {
  it("creates one targeted building without rebuilding terrain", () => {
    const harness = createHarness();

    harness.create({ category: 2, col: 1, row: 2 });

    expect(harness.applyBuildingInstance).toHaveBeenCalledOnce();
    expect(harness.rebuildTerrainMatrices).not.toHaveBeenCalled();
    harness.expectProjectionMatchesStore();
  });

  it("replaces the building at an occupied key", () => {
    const harness = createHarness([{ category: 2, col: 1, row: 2 }]);

    harness.replace({ category: 9, col: 1, row: 2 });

    expect(harness.applyBuildingInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        nextBuilding: { category: 9, col: 1, row: 2 },
      }),
    );
    expect(harness.rebuildTerrainMatrices).not.toHaveBeenCalled();
    harness.expectProjectionMatchesStore();
  });

  it("removes only the deleted building", () => {
    const harness = createHarness([
      { category: 2, col: 1, row: 2 },
      { category: 4, col: 3, row: 4 },
    ]);

    harness.remove({ col: 1, row: 2 });

    expect(harness.applyBuildingInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        nextBuilding: undefined,
      }),
    );
    expect(harness.rebuildTerrainMatrices).not.toHaveBeenCalled();
    harness.expectProjectionMatchesStore();
  });

  it("keeps a duplicate authoritative echo on the targeted path", () => {
    const building = { category: 2, col: 1, row: 2 };
    const harness = createHarness([building]);

    harness.echo({ ...building });

    expect(harness.applyBuildingInstance).toHaveBeenCalledOnce();
    expect(harness.rebuildTerrainMatrices).not.toHaveBeenCalled();
    harness.expectProjectionMatchesStore();
  });

  it("falls back loudly to a clean full reconciliation when identity is missing", () => {
    const harness = createHarness([{ category: 2, col: 1, row: 2 }]);
    harness.create({ category: 4, col: 3, row: 4 });
    harness.applyBuildingInstance.mockClear();

    harness.publish(undefined, 4);

    expect(harness.reportMissingIdentity).toHaveBeenCalledOnce();
    expect(harness.rebuildTerrainMatrices).toHaveBeenCalledOnce();
    expect(harness.applyBuildingInstance).not.toHaveBeenCalled();
    harness.expectProjectionMatchesStore();
  });
});

describe("resolveBuildingInstanceAction", () => {
  it.each([
    { current: undefined, expected: "create", next: "farm:ready" },
    { current: "farm:ready", expected: "replace", next: "mine:ready" },
    { current: "farm:ready", expected: "remove", next: undefined },
    { current: "farm:ready", expected: "keep", next: "farm:ready" },
  ] as const)("resolves $expected for the current and next render signatures", ({ current, expected, next }) => {
    expect(resolveBuildingInstanceAction(current, next)).toBe(expected);
  });
});

describe("a building's tier change", () => {
  it("is an upgrade when only the tier differs, and a new building otherwise", () => {
    const farm = (tier: number, pending = "ready") => `buildings:37:35:${pending}:tier${tier}`;
    expect(isTierChange(farm(1), farm(2))).toBe(true);
    expect(isTierChange(farm(2), farm(2))).toBe(false);
    expect(isTierChange(farm(1, "pending"), farm(2))).toBe(false);
    expect(isTierChange("buildings:28:26:ready:tier1", farm(2))).toBe(false);
    expect(isTierChange(undefined, farm(1))).toBe(false);
  });
});

describe("buildingEntrance", () => {
  it("takes the place of the player's own ghost at once, where the build sheet pinned it", () => {
    expect(buildingEntrance({ col: 10, row: 8 }, { col: 10, row: 8 })).toBe("overshoot");
  });

  it("grows in on any other plot, or with no ghost pinned", () => {
    expect(buildingEntrance({ col: 10, row: 8 }, { col: 11, row: 8 })).toBe("grow");
    expect(buildingEntrance({ col: 10, row: 8 }, null)).toBe("grow");
  });
});
