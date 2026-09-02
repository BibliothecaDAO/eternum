import { type HexPosition } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import { type HoverLabelReconcileResult } from "../managers/hover-label-manager";
import { WorldmapHoverLabelRecovery, type WorldmapHoverLabelRecoveryDeps } from "./worldmap-hover-label-recovery";

function makeResult(over: Partial<HoverLabelReconcileResult> = {}): HoverLabelReconcileResult {
  return {
    resolvedAnyEntity: true,
    shownAnyLabel: true,
    missingTypes: [],
    activeLabelCount: 0,
    labelsNeedRender: false,
    ...over,
  };
}

// A reconcile that resolved an entity but could not show its label yet — the case that parks a retry.
const PARKING_RESULT = makeResult({ resolvedAnyEntity: true, shownAnyLabel: false });

function createHarness() {
  let hoverHex: HexPosition | null = { col: 5, row: 7 };
  let switchedOff = false;
  let result = makeResult();
  const reconcileHexHover = vi.fn(() => result);
  const deps: WorldmapHoverLabelRecoveryDeps = {
    getHoverHex: () => hoverHex,
    isSwitchedOff: () => switchedOff,
    reconcileHexHover,
  };
  return {
    recovery: new WorldmapHoverLabelRecovery(deps),
    reconcileHexHover,
    setHoverHex: (h: HexPosition | null) => (hoverHex = h),
    setSwitchedOff: (v: boolean) => (switchedOff = v),
    setResult: (r: HoverLabelReconcileResult) => (result = r),
  };
}

describe("WorldmapHoverLabelRecovery", () => {
  it("skips reconciliation and stays idle when nothing is hovered", () => {
    const h = createHarness();
    h.setHoverHex(null);

    expect(h.recovery.reconcile("hover")).toBeNull();
    expect(h.reconcileHexHover).not.toHaveBeenCalled();
    expect(h.recovery.pendingSnapshot).toBeNull();
  });

  it("parks a pending retry, scoped to the hovered hex, when labels are not yet shown", () => {
    const h = createHarness();
    h.setResult(PARKING_RESULT);

    h.recovery.reconcile("manager_catch_up");

    expect(h.recovery.pendingSnapshot).toEqual({
      hex: { col: 5, row: 7 },
      reason: "manager_catch_up",
      remainingFrameRetries: 12,
    });
  });

  it("clears the pending retry once every label resolves", () => {
    const h = createHarness();
    h.setResult(PARKING_RESULT);
    h.recovery.reconcile("manager_catch_up");
    expect(h.recovery.pendingSnapshot).not.toBeNull();

    h.setResult(makeResult({ resolvedAnyEntity: true, shownAnyLabel: true }));
    h.recovery.reconcile("hover");

    expect(h.recovery.pendingSnapshot).toBeNull();
  });

  it("clears the pending retry when no entity resolves at all", () => {
    const h = createHarness();
    h.setResult(PARKING_RESULT);
    h.recovery.reconcile("manager_catch_up");

    h.setResult(makeResult({ resolvedAnyEntity: false }));
    h.recovery.reconcile("hover");

    expect(h.recovery.pendingSnapshot).toBeNull();
  });

  it("does not park while the scene is switched off", () => {
    const h = createHarness();
    h.setResult(PARKING_RESULT);
    h.setSwitchedOff(true);

    h.recovery.reconcile("manager_catch_up");

    expect(h.recovery.pendingSnapshot).toBeNull();
  });

  it("spends one frame-budget retry per frame while the hover holds", () => {
    const h = createHarness();
    h.setResult(PARKING_RESULT);
    h.recovery.reconcile("manager_catch_up");
    expect(h.reconcileHexHover).toHaveBeenCalledTimes(1);

    h.recovery.runFrame();

    expect(h.reconcileHexHover).toHaveBeenCalledTimes(2);
    expect(h.recovery.pendingSnapshot).toMatchObject({ reason: "frame_retry", remainingFrameRetries: 11 });
  });

  it("drops the pending retry when the hover moves to another hex", () => {
    const h = createHarness();
    h.setResult(PARKING_RESULT);
    h.recovery.reconcile("manager_catch_up");

    h.setHoverHex({ col: 9, row: 9 });
    h.recovery.runFrame();

    expect(h.recovery.pendingSnapshot).toBeNull();
  });

  it("retry does nothing when there is neither a pending retry nor a hover", () => {
    const h = createHarness();
    h.setHoverHex(null);

    h.recovery.retry("scene_ready");

    expect(h.reconcileHexHover).not.toHaveBeenCalled();
  });

  it("retry clears the pending retry when the scene is switched off", () => {
    const h = createHarness();
    h.setResult(PARKING_RESULT);
    h.recovery.reconcile("manager_catch_up");
    h.reconcileHexHover.mockClear();
    h.setSwitchedOff(true);

    h.recovery.retry("scene_ready");

    expect(h.recovery.pendingSnapshot).toBeNull();
    expect(h.reconcileHexHover).not.toHaveBeenCalled();
  });
});
