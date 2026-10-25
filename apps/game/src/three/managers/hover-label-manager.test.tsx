// @vitest-environment jsdom
import { act } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { MapPlateLayer, type MapPlateScope } from "../map-plates/map-plate-layer";
import type { ArmyPlate, StructurePlate } from "../map-plates/map-plate-model";
import { HoverLabelManager } from "./hover-label-manager";
import type { HoverLabelShowResult } from "./hover-label-show-result";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("HoverLabelManager", () => {
  it("returns a reconcile summary when no hover entity is resolved", () => {
    const manager = new HoverLabelManager(
      {
        army: {
          show: vi.fn(),
          hide: vi.fn(),
        },
      },
      () => ({}),
      undefined,
      vi.fn(),
    );

    const result = manager.reconcileHexHover({ col: 10, row: 12 });

    expect(result).toEqual({
      activeLabelCount: 0,
      labelsNeedRender: false,
      missingTypes: [],
      resolvedAnyEntity: false,
      shownAnyLabel: false,
    });
  });

  it("returns a reconcile summary when a manager target is still missing", () => {
    const manager = new HoverLabelManager(
      {
        army: {
          show: vi.fn((): HoverLabelShowResult => ({ status: "missing" })),
          hide: vi.fn(),
        },
      },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      vi.fn(),
    );

    const result = manager.reconcileHexHover({ col: 10, row: 12 });

    expect(result).toEqual({
      activeLabelCount: 0,
      labelsNeedRender: false,
      missingTypes: ["army"],
      resolvedAnyEntity: true,
      shownAnyLabel: false,
    });
  });

  it("returns a reconcile summary when a label is shown", () => {
    const manager = new HoverLabelManager(
      {
        army: {
          show: vi.fn((): HoverLabelShowResult => ({ status: "shown" })),
          hide: vi.fn(),
        },
      },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      vi.fn(),
    );

    const result = manager.reconcileHexHover({ col: 10, row: 12 });

    expect(result).toEqual({
      activeLabelCount: 1,
      labelsNeedRender: true,
      missingTypes: [],
      resolvedAnyEntity: true,
      shownAnyLabel: true,
    });
  });

  it("returns a reconcile summary when an active label is reattached", () => {
    const manager = new HoverLabelManager(
      {
        army: {
          show: vi.fn().mockReturnValueOnce({ status: "shown" }).mockReturnValueOnce({ status: "reattached" }),
          hide: vi.fn(),
        },
      },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      vi.fn(),
    );

    manager.reconcileHexHover({ col: 10, row: 12 });
    const result = manager.reconcileHexHover({ col: 10, row: 12 });

    expect(result).toEqual({
      activeLabelCount: 1,
      labelsNeedRender: true,
      missingTypes: [],
      resolvedAnyEntity: true,
      shownAnyLabel: true,
    });
  });

  it("returns a reconcile summary when an active label is unchanged", () => {
    const manager = new HoverLabelManager(
      {
        army: {
          show: vi.fn().mockReturnValueOnce({ status: "shown" }).mockReturnValueOnce({ status: "unchanged" }),
          hide: vi.fn(),
        },
      },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      vi.fn(),
    );

    manager.reconcileHexHover({ col: 10, row: 12 });
    const result = manager.reconcileHexHover({ col: 10, row: 12 });

    expect(result).toEqual({
      activeLabelCount: 1,
      labelsNeedRender: false,
      missingTypes: [],
      resolvedAnyEntity: true,
      shownAnyLabel: true,
    });
  });

  it("refreshes the same hovered hex when entity data arrives after loading", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    let armyId: number | undefined;
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: armyId === undefined ? undefined : { id: armyId, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    expect(manager.hasActiveLabels()).toBe(false);
    expect(army.show).not.toHaveBeenCalled();

    armyId = 42;
    manager.refreshCurrentHover();

    expect(army.show).toHaveBeenCalledWith(42);
    expect(manager.hasActiveLabels()).toBe(true);
    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
  });

  it("rechecks the same hovered hex when no label target was active yet", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    let armyId: number | undefined;
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: armyId === undefined ? undefined : { id: armyId, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    armyId = 42;
    manager.onHexHover({ col: 10, row: 12 });

    expect(army.show).toHaveBeenCalledWith(42);
    expect(manager.hasActiveLabels()).toBe(true);
    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
  });

  it("marks labels dirty when moving between army hover targets", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    const manager = new HoverLabelManager(
      { army },
      (hexCoords) => ({
        army: { id: hexCoords.col, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 1, row: 1 });
    manager.onHexHover({ col: 2, row: 1 });

    expect(army.hide).toHaveBeenCalledWith(1);
    expect(army.show).toHaveBeenNthCalledWith(1, 1);
    expect(army.show).toHaveBeenNthCalledWith(2, 2);
    expect(markLabelsDirty).toHaveBeenCalledTimes(2);
  });

  it("retries showing the current hover label when refreshing the same target", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    manager.refreshCurrentHover();

    expect(army.show).toHaveBeenCalledTimes(2);
    expect(army.show).toHaveBeenNthCalledWith(1, 42);
    expect(army.show).toHaveBeenNthCalledWith(2, 42);
    expect(markLabelsDirty).toHaveBeenCalledTimes(2);
  });

  it("retries the same hovered hex when an active label needs reattachment", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn().mockReturnValueOnce({ status: "shown" }).mockReturnValueOnce({ status: "reattached" }),
      hide: vi.fn(),
    };
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    manager.onHexHover({ col: 10, row: 12 });

    expect(army.show).toHaveBeenCalledTimes(2);
    expect(manager.hasActiveLabels()).toBe(true);
    expect(markLabelsDirty).toHaveBeenCalledTimes(2);
  });

  it("reports active labels only when at least one label target is active", () => {
    const manager = new HoverLabelManager(
      {
        army: {
          show: vi.fn(),
          hide: vi.fn(),
        },
      },
      () => ({}),
      undefined,
      vi.fn(),
    );

    manager.onHexHover({ col: 1, row: 1 });

    expect(manager.hasActiveLabels()).toBe(false);
  });

  it("does not mark a hover target active until the controller can show it", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn().mockReturnValueOnce({ status: "missing" }).mockReturnValueOnce({ status: "shown" }),
      hide: vi.fn(),
    };
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    manager.onHexHover({ col: 10, row: 12 });

    expect(army.show).toHaveBeenCalledTimes(2);
    expect(manager.hasActiveLabels()).toBe(true);
    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
  });

  it("does not mark labels dirty when a target is still missing during reconcile", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn((): HoverLabelShowResult => ({ status: "missing" })),
      hide: vi.fn(),
    };
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    manager.refreshCurrentHover();

    expect(army.show).toHaveBeenCalledTimes(2);
    expect(manager.hasActiveLabels()).toBe(false);
    expect(markLabelsDirty).not.toHaveBeenCalled();
  });

  it("hides a previously active label when retrying the same target reports it missing", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn().mockReturnValueOnce({ status: "shown" }).mockReturnValueOnce({ status: "missing" }),
      hide: vi.fn(),
    };
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    const result = manager.refreshCurrentHover();

    expect(army.hide).toHaveBeenCalledWith(42);
    expect(manager.hasActiveLabels()).toBe(false);
    expect(result).toMatchObject({
      activeLabelCount: 0,
      missingTypes: ["army"],
      resolvedAnyEntity: true,
      shownAnyLabel: false,
    });
  });

  it("marks labels dirty when a current hover target is reattached", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn().mockReturnValueOnce({ status: "shown" }).mockReturnValueOnce({ status: "reattached" }),
      hide: vi.fn(),
    };
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    manager.refreshCurrentHover();

    expect(manager.hasActiveLabels()).toBe(true);
    expect(markLabelsDirty).toHaveBeenCalledTimes(2);
  });

  it("does not mark labels dirty when a current hover target is unchanged", () => {
    const markLabelsDirty = vi.fn();
    const army = {
      show: vi.fn().mockReturnValueOnce({ status: "shown" }).mockReturnValueOnce({ status: "unchanged" }),
      hide: vi.fn(),
    };
    const manager = new HoverLabelManager(
      { army },
      () => ({
        army: { id: 42, owner: 1n },
      }),
      undefined,
      markLabelsDirty,
    );

    manager.onHexHover({ col: 10, row: 12 });
    manager.refreshCurrentHover();

    expect(manager.hasActiveLabels()).toBe(true);
    expect(markLabelsDirty).toHaveBeenCalledTimes(1);
  });

  describe("a tile an army stands on, where a structure resolves too", () => {
    // Prod, 25 October 2026: the owner's army stood on the camp it had cleared, whose marker stays on the tile.
    const army: ArmyPlate = {
      kind: "army",
      relation: "own",
      owner: "Maelis",
      homeName: "Stolsli",
      troops: { type: "knight", tier: 1, count: 4015 },
      stamina: { current: 106, max: 120 },
    };
    const clearedCamp: StructurePlate = {
      kind: "structure",
      relation: "neutral",
      owner: "",
      name: "Grimtear Camp",
      named: true,
      guards: null,
      arrivals: [],
      icon: "camp",
    };
    /** A manager's hover controller as ArmyManager and StructureManager give it: its plate scope's hover. */
    const opensIn = (scope: MapPlateScope) => ({
      show: (entityId: number): HoverLabelShowResult => {
        scope.setHover(entityId);
        return { status: "shown" };
      },
      hide: () => scope.clearHover(),
    });

    it("opens the army's plate, which nothing else on the tile can close", async () => {
      const container = document.createElement("div");
      document.body.append(container);
      const layer = new MapPlateLayer(() => container);
      const armies = layer.createScope("army");
      const structures = layer.createScope("structure");
      armies.setLabel({ entityId: 74, position: new Vector3(0, 0, 0), plate: army });
      structures.setLabel({ entityId: 76, position: new Vector3(0, 0, 0), plate: clearedCamp });
      const manager = new HoverLabelManager({ army: opensIn(armies), structure: opensIn(structures) }, () => ({
        army: { id: 74, owner: 1n },
        structure: { id: 76, owner: 0n },
      }));
      const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
      camera.position.set(0, 10, 10);
      camera.lookAt(0, 0, 0);

      manager.onHexHover({ col: 1, row: 1 });
      await act(async () => {
        await Promise.resolve();
      });
      layer.update(camera, 800, 600);

      const opened = [...container.querySelectorAll<HTMLElement>(".mp-at")]
        .filter((slot) => slot.querySelector('[data-open="true"]'))
        .map((slot) => slot.dataset.key);
      expect(opened).toEqual(["army:74"]);
      await act(async () => layer.dispose());
      container.remove();
    });
  });
});
