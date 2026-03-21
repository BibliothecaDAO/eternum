import { CameraView } from "../../scenes/hexagon-scene";
import { createContentContainer } from "./label-components";
import { LABEL_STYLES, LABEL_TYPE_CONFIGS } from "./label-config";
import { LabelData, LabelTypeDefinition } from "./label-types";
import { resolveCameraView } from "./label-view";
import { createLabelBase } from "./label-shared";
import { ArmyLabelType, type ArmyLabelData } from "./army-label-type";
import { StructureLabelType, convertStructureInfo, type StructureInfoCompat } from "./structure-label-type";

/**
 * Chest label data
 */
interface ChestLabelData extends LabelData {
  // Chests have minimal data
}

/**
 * Chest label type definition
 */
const ChestLabelType: LabelTypeDefinition<ChestLabelData> = {
  type: "chest",
  defaultConfig: LABEL_TYPE_CONFIGS.CHEST,

  createElement: (data: ChestLabelData, inputView: CameraView): HTMLElement => {
    const cameraView = resolveCameraView(inputView);
    const labelDiv = createLabelBase(false, cameraView);

    labelDiv.style.setProperty("color", LABEL_STYLES.CHEST.textColor!, "important");
    labelDiv.style.setProperty("background-color", LABEL_STYLES.CHEST.backgroundColor!, "important");
    labelDiv.style.setProperty("border-color", LABEL_STYLES.CHEST.borderColor!, "important");

    const img = document.createElement("img");
    img.src = "/images/labels/chest.png";
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    img.setAttribute("data-component", "chest-icon");
    labelDiv.appendChild(img);

    const contentContainer = createContentContainer(cameraView);

    const line1 = document.createElement("span");
    line1.textContent = "Relic Crate";
    line1.style.color = "inherit";
    contentContainer.appendChild(line1);

    labelDiv.appendChild(contentContainer.wrapper);
    return labelDiv;
  },

  updateElement: undefined,
};

/**
 * Factory function to create label type definitions with custom configurations
 */
function createCustomLabelType<T extends LabelData = LabelData>(
  type: string,
  config: Partial<LabelTypeDefinition<T>>,
): LabelTypeDefinition<T> {
  return {
    type,
    defaultConfig: config.defaultConfig || LABEL_TYPE_CONFIGS.ARMY,
    createElement: config.createElement || ((data, view) => document.createElement("div")),
    updateElement: config.updateElement,
    shouldDisplay: config.shouldDisplay,
  };
}

/**
 * Convenience functions for backward compatibility
 */
export const createArmyLabel = (army: ArmyLabelData, cameraView: CameraView): HTMLElement => {
  return ArmyLabelType.createElement(army, cameraView);
};

export const updateArmyLabel = (
  labelElement: HTMLElement,
  army: ArmyLabelData,
  cameraView: CameraView = CameraView.Medium,
): void => {
  ArmyLabelType.updateElement?.(labelElement, army, cameraView);
};

export const createStructureLabel = (structure: StructureInfoCompat, cameraView: CameraView): HTMLElement => {
  return StructureLabelType.createElement(convertStructureInfo(structure), cameraView);
};

export const updateStructureLabel = (
  labelElement: HTMLElement,
  structure: StructureInfoCompat,
  cameraView: CameraView = CameraView.Medium,
): void => {
  StructureLabelType.updateElement?.(labelElement, convertStructureInfo(structure), cameraView);
};

export const createChestLabel = (chest: ChestLabelData, cameraView: CameraView): HTMLElement => {
  return ChestLabelType.createElement(chest, cameraView);
};
