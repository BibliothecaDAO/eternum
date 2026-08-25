import { describe, expect, it, vi } from "vitest";

import { HoverLabelManager } from "./hover-label-manager";
import type { HoverLabelShowResult } from "./hover-label-show-result";

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

  it("keeps missing types in the summary when another label is shown", () => {
    const manager = new HoverLabelManager(
      {
        army: {
          show: vi.fn((): HoverLabelShowResult => ({ status: "missing" })),
          hide: vi.fn(),
        },
        structure: {
          show: vi.fn((): HoverLabelShowResult => ({ status: "shown" })),
          hide: vi.fn(),
        },
      },
      () => ({
        army: { id: 42, owner: 1n },
        structure: { id: 99, owner: 1n },
      }),
      undefined,
      vi.fn(),
    );

    const result = manager.reconcileHexHover({ col: 10, row: 12 });

    expect(result).toEqual({
      activeLabelCount: 1,
      labelsNeedRender: true,
      missingTypes: ["army"],
      resolvedAnyEntity: true,
      shownAnyLabel: true,
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
});
