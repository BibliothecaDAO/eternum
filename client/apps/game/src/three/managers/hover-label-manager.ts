import { CameraView } from "../scenes/hexagon-scene";
import { HexPosition, ID, HexEntityInfo } from "@bibliothecadao/types";

export type HoverLabelController = {
  show: (entityId: ID) => void;
  hide: (entityId: ID) => void;
  hideAll?: () => void;
};

export type HoverLabelControllers = {
  army?: HoverLabelController;
  structure?: HoverLabelController;
  quest?: HoverLabelController;
  chest?: HoverLabelController;
};

type HoverLabelType = keyof HoverLabelControllers;

type HexagonEntities = {
  army?: HexEntityInfo;
  structure?: HexEntityInfo;
  quest?: HexEntityInfo;
  chest?: HexEntityInfo;
};

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
    if (
      this.currentHoveredHex &&
      this.currentHoveredHex.col === hexCoords.col &&
      this.currentHoveredHex.row === hexCoords.row
    ) {
      return;
    }

    const { army, structure, quest, chest } = this.getHexagonEntity(hexCoords);

    this.toggleLabel("army", army?.id);
    this.toggleLabel("structure", structure?.id);
    this.toggleLabel("quest", quest?.id);
    this.toggleLabel("chest", chest?.id);

    this.currentHoveredHex = hexCoords;
  }

  /**
   * Handle mouse leaving the grid. All active labels are removed.
   */
  onHexLeave(): void {
    (Object.keys(this.activeLabels) as HoverLabelType[]).forEach((type) => {
      const activeId = this.activeLabels[type];
      const controller = this.controllers[type];

      if (controller && activeId !== undefined) {
        controller.hide(activeId);
      }

      delete this.activeLabels[type];
    });

    Object.values(this.controllers).forEach((controller) => controller?.hideAll?.());

    this.currentHoveredHex = null;
  }

  /**
   * Keep track of camera view to stay API-compatible with existing callers.
   */
  updateCameraView(newCameraView: CameraView): void {
    // Labels are now driven purely by hover state; camera view changes are handled by the entity managers.
    this.lastCameraView = newCameraView;
  }

  public hasActiveLabels(): boolean {
    return this.currentHoveredHex !== null;
  }

  private toggleLabel(type: HoverLabelType, entityId?: ID): void {
    const controller = this.controllers[type];
    if (!controller) {
      return;
    }

    const currentId = this.activeLabels[type];

    if (currentId !== undefined && (entityId === undefined || currentId !== entityId)) {
      controller.hide(currentId);
      delete this.activeLabels[type];
    }

    if (entityId === undefined || entityId === null) {
      return;
    }

    if (currentId === entityId) {
      return;
    }

    controller.show(entityId);
    this.activeLabels[type] = entityId;
  }
}
