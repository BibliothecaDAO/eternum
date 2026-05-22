import { CameraView } from "../scenes/camera-view";
import { HexPosition, ID } from "@bibliothecadao/types";
import {
  didChangeHoverLabelRenderState,
  didShowHoverLabel,
  normalizeHoverLabelShowResult,
  type HoverLabelShowResult,
} from "./hover-label-show-result";

interface HoverLabelEntity {
  id: ID;
}

type HoverLabelController = {
  show: (entityId: ID) => HoverLabelShowResult | boolean | void;
  hide: (entityId: ID) => void;
  hideAll?: () => void;
};

type HoverLabelControllers = {
  army?: HoverLabelController;
  structure?: HoverLabelController;
  quest?: HoverLabelController;
  chest?: HoverLabelController;
};

type HoverLabelType = keyof HoverLabelControllers;

type HexagonEntities = {
  army?: HoverLabelEntity;
  structure?: HoverLabelEntity;
  quest?: HoverLabelEntity;
  chest?: HoverLabelEntity;
};

interface ReconcileHoveredHexLabelsOptions {
  retryActiveLabels?: boolean;
}

interface ShowAndTrackLabelResult {
  renderChanged: boolean;
  shown: boolean;
}

/**
 * Manager responsible for creating and disposing of CSS labels as the pointer moves across hexes.
 * Labels now exist only while a player is actively hovering a tile. The concrete entity managers
 * supply the show/hide handlers so we can delegate the actual DOM work to them.
 */
export class HoverLabelManager {
  private readonly controllers: HoverLabelControllers;
  private readonly getHexagonEntity: (hexCoords: HexPosition) => HexagonEntities;

  private currentHoveredHex: HexPosition | null = null;
  private activeLabels: Partial<Record<HoverLabelType, ID>> = {};
  private lastCameraView: CameraView;

  constructor(
    controllers: HoverLabelControllers,
    getHexagonEntityFn: (hexCoords: HexPosition) => HexagonEntities,
    initialCameraView: CameraView = CameraView.Medium,
    private readonly markLabelsDirty: () => void = () => {},
  ) {
    this.controllers = controllers;
    this.getHexagonEntity = getHexagonEntityFn;
    this.lastCameraView = initialCameraView;
  }

  /**
   * Handle mouse hover over a hex. Creates labels for entities present on the tile and
   * tears down labels from the previously hovered tile.
   */
  onHexHover(hexCoords: HexPosition): void {
    if (this.isCurrentHoveredHex(hexCoords) && this.hasActiveLabels()) {
      return;
    }

    this.currentHoveredHex = hexCoords;
    this.reconcileHoveredHexLabels(hexCoords);
  }

  public reconcileHexHover(hexCoords: HexPosition): void {
    if (!this.isCurrentHoveredHex(hexCoords)) {
      this.onHexHover(hexCoords);
      return;
    }

    this.refreshCurrentHover();
  }

  public refreshCurrentHover(): void {
    if (!this.currentHoveredHex) {
      return;
    }

    this.reconcileHoveredHexLabels(this.currentHoveredHex, { retryActiveLabels: true });
  }

  /**
   * Handle mouse leaving the grid. All active labels are removed.
   */
  onHexLeave(): void {
    let labelsNeedRender = false;
    (Object.keys(this.activeLabels) as HoverLabelType[]).forEach((type) => {
      const activeId = this.activeLabels[type];
      if (activeId !== undefined) {
        this.controllers[type]?.hide(activeId);
        labelsNeedRender = true;
      }
      delete this.activeLabels[type];
    });

    this.currentHoveredHex = null;
    this.markDirtyIfLabelsNeedRender(labelsNeedRender);
  }

  /**
   * Keep track of camera view to stay API-compatible with existing callers.
   */
  updateCameraView(newCameraView: CameraView): void {
    // Labels are now driven purely by hover state; camera view changes are handled by the entity managers.
    this.lastCameraView = newCameraView;
  }

  public hasActiveLabels(): boolean {
    return this.getActiveLabelCount() > 0;
  }

  public getActiveLabelCount(): number {
    return Object.keys(this.activeLabels).length;
  }

  /**
   * Release all held label references. Safe to call multiple times.
   */
  dispose(): void {
    this.onHexLeave();
  }

  private isCurrentHoveredHex(hexCoords: HexPosition): boolean {
    return (
      this.currentHoveredHex !== null &&
      this.currentHoveredHex.col === hexCoords.col &&
      this.currentHoveredHex.row === hexCoords.row
    );
  }

  private reconcileHoveredHexLabels(hexCoords: HexPosition, options?: ReconcileHoveredHexLabelsOptions): void {
    const { army, structure, quest, chest } = this.getHexagonEntity(hexCoords);
    const labelsNeedRender = [
      this.toggleLabel("army", army?.id, options),
      this.toggleLabel("structure", structure?.id, options),
      this.toggleLabel("quest", quest?.id, options),
      this.toggleLabel("chest", chest?.id, options),
    ].some(Boolean);

    this.markDirtyIfLabelsNeedRender(labelsNeedRender);
  }

  private toggleLabel(type: HoverLabelType, entityId?: ID, options?: ReconcileHoveredHexLabelsOptions): boolean {
    const controller = this.controllers[type];
    if (!controller) {
      return false;
    }

    const currentId = this.activeLabels[type];
    let labelChanged = false;

    if (currentId !== undefined && (entityId === undefined || currentId !== entityId)) {
      controller.hide(currentId);
      delete this.activeLabels[type];
      labelChanged = true;
    }

    if (entityId === undefined || entityId === null) {
      return labelChanged;
    }

    if (currentId === entityId) {
      if (options?.retryActiveLabels) {
        // Re-issue show because lifecycle transitions can detach the CSS2D object while hover state stays active.
        const result = this.showAndTrackLabel(controller, type, entityId);
        if (result.shown) {
          return result.renderChanged;
        }

        delete this.activeLabels[type];
        return true;
      }
      return labelChanged;
    }

    const result = this.showAndTrackLabel(controller, type, entityId);
    return result.renderChanged || labelChanged;
  }

  private showAndTrackLabel(
    controller: HoverLabelController,
    type: HoverLabelType,
    entityId: ID,
  ): ShowAndTrackLabelResult {
    const currentId = this.activeLabels[type];
    const result = normalizeHoverLabelShowResult(controller.show(entityId));

    if (!didShowHoverLabel(result)) {
      return {
        renderChanged: false,
        shown: false,
      };
    }

    this.activeLabels[type] = entityId;
    return {
      renderChanged: currentId !== entityId || didChangeHoverLabelRenderState(result),
      shown: true,
    };
  }

  private markDirtyIfLabelsNeedRender(labelsNeedRender: boolean): void {
    if (labelsNeedRender) {
      this.markLabelsDirty();
    }
  }
}
