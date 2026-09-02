import { type HexPosition } from "@bibliothecadao/types";

import { runWithFrameWorkOwner } from "@/three/frame-work-owner";
import { VERBOSE_LOGS_ENABLED } from "@/utils/dev-mode";

import { type HoverLabelReconcileResult } from "../managers/hover-label-manager";

const HOVER_LABEL_RECOVERY_FRAME_BUDGET = 12;

export type HoverLabelRecoveryReason =
  | "hover"
  | "initial_refresh"
  | "manager_catch_up"
  | "critical_manager_catch_up"
  | "non_critical_manager_catch_up"
  | "scene_ready"
  | "frame_retry";

interface PendingHoverLabelRecovery {
  hex: HexPosition;
  reason: HoverLabelRecoveryReason;
  remainingFrameRetries: number;
}

export interface WorldmapHoverLabelRecoveryDeps {
  getHoverHex: () => HexPosition | null;
  isSwitchedOff: () => boolean;
  reconcileHexHover: (hex: HexPosition) => HoverLabelReconcileResult;
}

/**
 * Owns the "keep retrying the hovered hex until its labels resolve" state machine. A hover reconcile
 * that resolves an entity but cannot yet show every label parks a pending retry (scoped to that hex,
 * with a frame budget); readiness events and the per-frame tick drive it, and any change of hover or
 * scene lifecycle clears it. The single piece of state is that pending retry; the hovered hex and the
 * switch-off flag stay with the scene and are read through injected accessors.
 */
export class WorldmapHoverLabelRecovery {
  private pending: PendingHoverLabelRecovery | null = null;

  constructor(private readonly deps: WorldmapHoverLabelRecoveryDeps) {}

  get pendingSnapshot(): Readonly<PendingHoverLabelRecovery> | null {
    return this.pending;
  }

  reconcile(reason: HoverLabelRecoveryReason = "hover"): HoverLabelReconcileResult | null {
    const hoverHex = this.deps.getHoverHex();
    if (!hoverHex) {
      this.clear("no_hover");
      return null;
    }

    const result = runWithFrameWorkOwner("hover:reconcile", () => this.deps.reconcileHexHover(hoverHex));
    this.applyResult(result, reason);
    this.trace("reconcile", {
      reason,
      hex: this.deps.getHoverHex(),
      result,
      pending: this.pending,
    });

    return result;
  }

  retry(reason: HoverLabelRecoveryReason): void {
    const hoverHex = this.deps.getHoverHex();
    if (!this.pending && !hoverHex) {
      return;
    }

    if (this.deps.isSwitchedOff() || !hoverHex) {
      this.clear("inactive_retry");
      return;
    }

    this.reconcile(reason);
  }

  runFrame(): void {
    if (!this.pending) {
      return;
    }

    const hoverHex = this.deps.getHoverHex();
    if (this.deps.isSwitchedOff() || !hoverHex || !this.isPendingForHex(hoverHex)) {
      this.clear("frame_inactive");
      return;
    }

    if (this.pending.remainingFrameRetries <= 0) {
      this.clear("frame_budget_exhausted");
      return;
    }

    this.pending.remainingFrameRetries -= 1;
    this.reconcile("frame_retry");
  }

  clear(reason: string): void {
    if (!this.pending) {
      return;
    }

    this.trace("clear", {
      reason,
      pending: this.pending,
    });
    this.pending = null;
  }

  private applyResult(result: HoverLabelReconcileResult, reason: HoverLabelRecoveryReason): void {
    const hoverHex = this.deps.getHoverHex();
    if (!hoverHex || this.deps.isSwitchedOff()) {
      this.clear("inactive");
      return;
    }

    if (!result.resolvedAnyEntity) {
      this.clear("no_entity");
      return;
    }

    if (result.shownAnyLabel && result.missingTypes.length === 0) {
      this.clear("resolved");
      return;
    }

    const pendingHex = { ...hoverHex };
    if (reason === "frame_retry") {
      if (!this.pending || !this.isPendingForHex(pendingHex)) {
        return;
      }
      this.pending = {
        ...this.pending,
        reason,
      };
      return;
    }

    this.pending = {
      hex: pendingHex,
      reason,
      remainingFrameRetries: HOVER_LABEL_RECOVERY_FRAME_BUDGET,
    };
  }

  private isPendingForHex(hex: HexPosition): boolean {
    return this.pending !== null && this.pending.hex.col === hex.col && this.pending.hex.row === hex.row;
  }

  private trace(event: string, details: Record<string, unknown>): void {
    if (!import.meta.env.DEV || !VERBOSE_LOGS_ENABLED) {
      return;
    }

    console.debug(`[WorldmapHoverLabels] ${event}`, details);
  }
}
