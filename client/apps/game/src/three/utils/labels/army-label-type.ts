import { getCharacterName } from "@/utils/agent";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { CameraView } from "../../scenes/hexagon-scene";
import {
  createContentContainer,
  createDirectionIndicators,
  createOwnerDisplayElement,
  createStaminaBar,
  createTroopCountDisplay,
  updateDirectionIndicators,
  updateStaminaBar,
} from "./label-components";
import { getOwnershipStyle, LABEL_TYPE_CONFIGS } from "./label-config";
import { LabelData, LabelTypeDefinition } from "./label-types";
import { resolveCameraView } from "./label-view";
import { attachDirectionIndicators, createLabelBase } from "./label-shared";

export interface ArmyLabelData extends LabelData {
  category: TroopType;
  tier: TroopTier;
  isMine: boolean;
  isDaydreamsAgent: boolean;
  owner: {
    address: bigint;
    ownerName: string;
    guildName: string;
  };
  color: string;
  troopCount: number;
  currentStamina: number;
  maxStamina: number;
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleTimerLeft?: number;
}

export const ArmyLabelType: LabelTypeDefinition<ArmyLabelData> = {
  type: "army",
  defaultConfig: LABEL_TYPE_CONFIGS.ARMY,

  createElement: (data: ArmyLabelData, inputView: CameraView): HTMLElement => {
    const cameraView = resolveCameraView(inputView);
    // Create base label
    const labelDiv = createLabelBase(data.isMine, cameraView, data.isDaydreamsAgent);
    labelDiv.style.transform = "scale(0.5)";
    labelDiv.style.transformOrigin = "center bottom";

    // Check if we have direction indicators and if view is expanded
    const hasDirections = data.attackedFromDegrees !== undefined || data.attackedTowardDegrees !== undefined;
    const isExpanded = cameraView !== CameraView.Far;

    // Add army icon
    const img = document.createElement("img");
    img.src = data.isDaydreamsAgent
      ? "/images/logos/daydreams.png"
      : `/images/labels/${data.isMine ? "army" : "enemy_army"}.png`;
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    img.setAttribute("data-component", "army-icon");

    // Create text container
    const textContainer = createContentContainer(cameraView);

    // Add owner information
    const ownerDisplay = createOwnerDisplayElement({
      owner: data.owner,
      isMine: data.isMine,
      cameraView,
      color: data.color,
      isDaydreamsAgent: data.isDaydreamsAgent,
    });
    textContainer.appendChild(ownerDisplay);

    // Add troop type information for Daydreams agents
    if (data.isDaydreamsAgent) {
      const line2 = document.createElement("strong");
      line2.textContent = getCharacterName(data.tier, data.category, data.entityId) || "";
      textContainer.appendChild(line2);
    }

    // Add troop count display
    let troopCountDisplay: HTMLElement | undefined;
    if (data.troopCount !== undefined) {
      troopCountDisplay = createTroopCountDisplay(data.troopCount, data.category, data.tier, cameraView);
      textContainer.appendChild(troopCountDisplay);
    }

    let staminaHandledInline = false;
    if (
      cameraView === CameraView.Medium &&
      troopCountDisplay &&
      data.currentStamina !== undefined &&
      data.maxStamina !== undefined &&
      data.maxStamina > 0
    ) {
      const staminaBar = createStaminaBar(data.currentStamina, data.maxStamina, cameraView);
      troopCountDisplay.appendChild(staminaBar);
      staminaHandledInline = true;
    }

    if (!staminaHandledInline) {
      if (data.currentStamina !== undefined && data.maxStamina !== undefined && data.maxStamina > 0) {
        const staminaBar = createStaminaBar(data.currentStamina, data.maxStamina, cameraView);
        textContainer.appendChild(staminaBar);
      } else if (data.currentStamina !== undefined && cameraView !== CameraView.Medium) {
        const staminaInfo = document.createElement("div");
        staminaInfo.classList.add("flex", "items-center", "text-xxs", "gap-1");

        const staminaIcon = document.createElement("span");
        staminaIcon.textContent = "⚡";
        staminaIcon.classList.add("text-yellow-400");
        staminaInfo.appendChild(staminaIcon);

        const staminaText = document.createElement("span");
        staminaText.textContent = `${data.currentStamina}`;
        staminaText.classList.add("font-mono");
        staminaText.style.color = "#f6f1e5";
        staminaInfo.appendChild(staminaText);

        textContainer.appendChild(staminaInfo);
      }
    }

    // Structure based on view and directions
    if (hasDirections && isExpanded) {
      // Expanded with directions: flex-col layout
      labelDiv.classList.remove("inline-flex", "items-center");
      labelDiv.classList.add("flex", "flex-col");

      // Create content row for icon and text
      const contentRow = document.createElement("div");
      contentRow.classList.add("flex", "items-center");
      contentRow.appendChild(img);
      contentRow.appendChild(textContainer.wrapper);
      labelDiv.appendChild(contentRow);

      const directionIndicators = createDirectionIndicators(
        data.attackedFromDegrees,
        data.attackedTowardDegrees,
        data.battleTimerLeft,
      );

      attachDirectionIndicators(labelDiv, directionIndicators, cameraView);
    } else {
      // Contracted or no directions: simple horizontal layout
      labelDiv.appendChild(img);
      labelDiv.appendChild(textContainer.wrapper);

      // Add direction indicators to the right
      if (hasDirections) {
        const directionIndicators = createDirectionIndicators(
          data.attackedFromDegrees,
          data.attackedTowardDegrees,
          data.battleTimerLeft,
        );

        attachDirectionIndicators(labelDiv, directionIndicators, cameraView);
      }
    }

    return labelDiv;
  },

  updateElement: (element: HTMLElement, data: ArmyLabelData, inputView: CameraView): void => {
    const cameraView = resolveCameraView(inputView);
    // Check if we have direction indicators and if view is expanded
    const hasDirections = data.attackedFromDegrees !== undefined || data.attackedTowardDegrees !== undefined;
    const isExpanded = cameraView !== CameraView.Far;

    // Update layout based on view state
    if (hasDirections && isExpanded) {
      element.classList.remove("inline-flex", "items-center");
      element.classList.add("flex", "flex-col");
    } else {
      element.classList.remove("flex", "flex-col");
      element.classList.add("inline-flex", "items-center");
    }

    // Update container colors based on ownership
    const styles = getOwnershipStyle(data.isMine, data.isDaydreamsAgent);
    element.style.setProperty("background-color", styles.default.backgroundColor!, "important");
    element.style.setProperty("border", `1px solid ${styles.default.borderColor}`, "important");
    element.style.setProperty("color", styles.default.textColor!, "important");

    element.onmouseenter = () => {
      element.style.setProperty("background-color", styles.hover.backgroundColor!, "important");
    };

    element.onmouseleave = () => {
      element.style.setProperty("background-color", styles.default.backgroundColor!, "important");
    };

    const contentContainer = element.querySelector('[data-component="content-container"]') as HTMLElement | null;

    if (contentContainer) {
      contentContainer.innerHTML = "";

      if (cameraView === CameraView.Medium) {
        contentContainer.classList.add("gap-1");
      } else if (cameraView === CameraView.Close) {
        contentContainer.classList.add("gap-1");
      } else {
        contentContainer.classList.remove("gap-1");
      }

      if (cameraView !== CameraView.Far) {
        const spacerDiv = document.createElement("div");
        spacerDiv.classList.add(cameraView === CameraView.Medium ? "w-1" : "w-2");
        contentContainer.appendChild(spacerDiv);
      }

      const ownerDisplay = createOwnerDisplayElement({
        owner: data.owner,
        isMine: data.isMine,
        cameraView,
        color: data.color,
        isDaydreamsAgent: data.isDaydreamsAgent,
      });
      contentContainer.appendChild(ownerDisplay);

      if (data.isDaydreamsAgent) {
        const line2 = document.createElement("strong");
        line2.textContent = getCharacterName(data.tier, data.category, data.entityId) || "";
        contentContainer.appendChild(line2);
      }

      let troopCountDisplay: HTMLElement | undefined;
      if (data.troopCount !== undefined) {
        troopCountDisplay = createTroopCountDisplay(data.troopCount, data.category, data.tier, cameraView);
        contentContainer.appendChild(troopCountDisplay);
      }

      let staminaHandledInline = false;
      if (
        cameraView === CameraView.Medium &&
        troopCountDisplay &&
        data.currentStamina !== undefined &&
        data.maxStamina !== undefined &&
        data.maxStamina > 0
      ) {
        const staminaBar = createStaminaBar(data.currentStamina, data.maxStamina, cameraView);
        troopCountDisplay.appendChild(staminaBar);
        staminaHandledInline = true;
      }

      if (!staminaHandledInline) {
        if (data.currentStamina !== undefined && data.maxStamina !== undefined && data.maxStamina > 0) {
          const staminaBar = createStaminaBar(data.currentStamina, data.maxStamina, cameraView);
          contentContainer.appendChild(staminaBar);
        } else if (data.currentStamina !== undefined && cameraView !== CameraView.Medium) {
          const staminaInfo = document.createElement("div");
          staminaInfo.classList.add("flex", "items-center", "text-xxs", "gap-1");

          const staminaIcon = document.createElement("span");
          staminaIcon.textContent = "⚡";
          staminaIcon.classList.add("text-yellow-400");
          staminaInfo.appendChild(staminaIcon);

          const staminaText = document.createElement("span");
          staminaText.textContent = `${data.currentStamina}`;
          staminaText.classList.add("font-mono");
          staminaText.style.color = "#f6f1e5";
          staminaInfo.appendChild(staminaText);

          contentContainer.appendChild(staminaInfo);
        }
      }
    }

    const armyIcon = element.querySelector('[data-component="army-icon"]') as HTMLImageElement;
    if (armyIcon) {
      armyIcon.src = data.isDaydreamsAgent
        ? "/images/logos/daydreams.png"
        : `/images/labels/${data.isMine ? "army" : "enemy_army"}.png`;
    }

    const staminaBar = element.querySelector('[data-component="stamina-bar"]');
    if (staminaBar && data.currentStamina !== undefined && data.maxStamina !== undefined) {
      updateStaminaBar(staminaBar as HTMLElement, data.currentStamina, data.maxStamina);
    }

    const directionIndicators = updateDirectionIndicators(
      element,
      data.attackedFromDegrees,
      data.attackedTowardDegrees,
      data.battleTimerLeft,
    );

    attachDirectionIndicators(element, directionIndicators, cameraView);
  },
};
