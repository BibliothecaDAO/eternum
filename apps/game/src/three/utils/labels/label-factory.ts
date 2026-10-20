import { iconUrl } from "@/ui/design-system/icon-meaning";
import { CameraView } from "../../scenes/camera-view";
import { createContentContainer } from "./label-components";
import { LABEL_STYLES, LABEL_TYPE_CONFIGS } from "./label-config";
import { LabelData, LabelTypeDefinition } from "./label-types";
import { resolveCameraView } from "./label-view";
import { createLabelBase } from "./label-shared";

/**
 * Chest label type definition
 */
const ChestLabelType: LabelTypeDefinition<LabelData> = {
  type: "chest",
  defaultConfig: LABEL_TYPE_CONFIGS.CHEST,

  createElement: (data: LabelData, inputView: CameraView): HTMLElement => {
    const cameraView = resolveCameraView(inputView);
    const labelDiv = createLabelBase(false, cameraView);

    labelDiv.style.setProperty("color", LABEL_STYLES.CHEST.textColor!, "important");
    labelDiv.style.setProperty("background-color", LABEL_STYLES.CHEST.backgroundColor!, "important");
    labelDiv.style.setProperty("border-color", LABEL_STYLES.CHEST.borderColor!, "important");

    const img = document.createElement("img");
    img.src = iconUrl("chest");
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    img.setAttribute("data-component", "chest-icon");
    labelDiv.appendChild(img);

    const contentContainer = createContentContainer(cameraView);

    const line1 = document.createElement("span");
    line1.textContent = data.rewardKind === "lords" ? "Reward Chest" : "Relic Crate";
    line1.style.color = "inherit";
    contentContainer.appendChild(line1);

    const hint = document.createElement("span");
    hint.textContent = "Right-click with an army to open";
    hint.classList.add("text-[10px]", "opacity-80");
    hint.setAttribute("data-role", "chest-hint");
    contentContainer.appendChild(hint);

    labelDiv.appendChild(contentContainer.wrapper);
    return labelDiv;
  },

  updateElement: undefined,
};

export const createChestLabel = (chest: LabelData, cameraView: CameraView): HTMLElement => {
  return ChestLabelType.createElement(chest, cameraView);
};
