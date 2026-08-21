import { describe, expect, it, vi } from "vitest";
import {
  buildingKey,
  reconcileBuildingUpdate,
  resolveBuildingInstanceAction,
  runOwnedBuildingWorkAfterModelsLoad,
  type PositionedBuilding,
} from "./hexception-building-reconciliation";

interface TestBuilding extends PositionedBuilding {
  category: number;
}

interface Deferred<T> {
  promise: Promise<T>;
  reject(reason: unknown): void;
  resolve(value: T): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createOwnedBuildingWorkHarness() {
  let activeRealmGeneration = 1;
  const modelsLoaded = createDeferred<void>();
  const apply = vi.fn();
  const capturedRealmGeneration = activeRealmGeneration;
  const completion = runOwnedBuildingWorkAfterModelsLoad({
    apply,
    isOwned: () => capturedRealmGeneration === activeRealmGeneration,
    modelLoadPromises: [modelsLoaded.promise],
  });

  return {
    apply,
    completion,
    destroyScene() {
      activeRealmGeneration += 1;
    },
    finishLoadingModels() {
      modelsLoaded.resolve();
    },
    failLoadingModels() {
      modelsLoaded.reject(new Error("model load failed"));
    },
    switchRealm() {
      activeRealmGeneration += 1;
    },
  };
}

function createHarness(initialBuildings: TestBuilding[] = []) {
  const recsBuildings = new Map(initialBuildings.map((building) => [buildingKey(building), building]));
  let projectedBuildings = [...initialBuildings];
  const applyBuildingInstance = vi.fn();
  const rebuildTerrainMatrices = vi.fn();
  const reportMissingIdentity = vi.fn();

  const publish = (innerCol?: number, innerRow?: number) => {
    reconcileBuildingUpdate({
      applyFullFallback: () => {
        projectedBuildings = [...recsBuildings.values()];
        rebuildTerrainMatrices();
      },
      applyTargeted: (reconciliation) => {
        projectedBuildings = reconciliation.buildings;
        applyBuildingInstance(reconciliation);
      },
      buildings: projectedBuildings,
      reportMissingIdentity,
      resolveBuilding: (position) => recsBuildings.get(buildingKey(position)),
      update: { innerCol, innerRow },
    });
  };

  const expectProjectionMatchesRecs = () => {
    const normalize = (buildings: Iterable<TestBuilding>) =>
      [...buildings].toSorted((left, right) => buildingKey(left).localeCompare(buildingKey(right)));
    expect(normalize(projectedBuildings)).toEqual(normalize(recsBuildings.values()));
  };

  return {
    applyBuildingInstance,
    create(building: TestBuilding) {
      recsBuildings.set(buildingKey(building), building);
      publish(building.col, building.row);
    },
    echo(building: TestBuilding) {
      recsBuildings.set(buildingKey(building), building);
      publish(building.col, building.row);
    },
    expectProjectionMatchesRecs,
    publish,
    rebuildTerrainMatrices,
    remove(position: PositionedBuilding) {
      recsBuildings.delete(buildingKey(position));
      publish(position.col, position.row);
    },
    replace(building: TestBuilding) {
      recsBuildings.set(buildingKey(building), building);
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
    harness.expectProjectionMatchesRecs();
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
    harness.expectProjectionMatchesRecs();
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
    harness.expectProjectionMatchesRecs();
  });

  it("keeps a duplicate authoritative echo on the targeted path", () => {
    const building = { category: 2, col: 1, row: 2 };
    const harness = createHarness([building]);

    harness.echo({ ...building });

    expect(harness.applyBuildingInstance).toHaveBeenCalledOnce();
    expect(harness.rebuildTerrainMatrices).not.toHaveBeenCalled();
    harness.expectProjectionMatchesRecs();
  });

  it("falls back loudly to a clean full reconciliation when identity is missing", () => {
    const harness = createHarness([{ category: 2, col: 1, row: 2 }]);
    harness.create({ category: 4, col: 3, row: 4 });
    harness.applyBuildingInstance.mockClear();

    harness.publish(undefined, 4);

    expect(harness.reportMissingIdentity).toHaveBeenCalledOnce();
    expect(harness.rebuildTerrainMatrices).toHaveBeenCalledOnce();
    expect(harness.applyBuildingInstance).not.toHaveBeenCalled();
    harness.expectProjectionMatchesRecs();
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

describe("owned building work after model loading", () => {
  it("applies delayed work when the originating realm still owns it", async () => {
    const harness = createOwnedBuildingWorkHarness();

    harness.finishLoadingModels();
    await harness.completion;

    expect(harness.apply).toHaveBeenCalledOnce();
  });

  it("drops delayed work after switching realms", async () => {
    const harness = createOwnedBuildingWorkHarness();

    harness.switchRealm();
    harness.finishLoadingModels();
    await harness.completion;

    expect(harness.apply).not.toHaveBeenCalled();
  });

  it("drops delayed work after scene destruction", async () => {
    const harness = createOwnedBuildingWorkHarness();

    harness.destroyScene();
    harness.finishLoadingModels();
    await harness.completion;

    expect(harness.apply).not.toHaveBeenCalled();
  });

  it("reconciles after a failed model load instead of poisoning later work", async () => {
    const harness = createOwnedBuildingWorkHarness();

    harness.failLoadingModels();
    await harness.completion;

    expect(harness.apply).toHaveBeenCalledOnce();
  });
});
