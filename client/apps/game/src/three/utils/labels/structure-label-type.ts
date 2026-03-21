import { getGameModeConfig } from "@/config/game-modes";
import { Position } from "@bibliothecadao/eternum";
import { BuildingType, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { CameraView } from "../../scenes/hexagon-scene";
import {
  createContentContainer,
  createDirectionIndicators,
  createGuardArmyDisplay,
  createOwnerDisplayElement,
  createProductionDisplay,
  updateDirectionIndicators,
  updateGuardArmyDisplay,
  updateProductionDisplay,
} from "./label-components";
import { getOwnershipStyle, LABEL_TYPE_CONFIGS } from "./label-config";
import { LabelData, LabelTypeDefinition } from "./label-types";
import { resolveCameraView } from "./label-view";
import { attachDirectionIndicators, createLabelBase } from "./label-shared";

/**
 * Structure icon paths
 */
const STRUCTURE_ICONS = (fragmentMineIcon: string) => ({
  STRUCTURES: {
    [StructureType.Village]: "/images/labels/enemy_village.png",
    [StructureType.Camp]: "/images/labels/enemy_village.png",
    [StructureType.Realm]: "/images/labels/enemy_realm.png",
    [StructureType.Hyperstructure]: "/images/labels/hyperstructure.png",
    [StructureType.HolySite]: "/images/labels/hyperstructure.png",
    [StructureType.Bank]: `/images/resources/${ResourcesIds.Lords}.png`,
    [StructureType.FragmentMine]: fragmentMineIcon,
    [StructureType.BitcoinMine]: fragmentMineIcon,
  } as Record<StructureType, string>,
  MY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/village.png",
    [StructureType.Camp]: "/images/labels/village.png",
    [StructureType.Realm]: "/images/labels/realm.png",
  } as Record<StructureType, string>,
  ALLY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/allies_village.png",
    [StructureType.Camp]: "/images/labels/allies_village.png",
    [StructureType.Realm]: "/images/labels/allies_realm.png",
  } as Record<StructureType, string>,
});

export interface StructureLabelData extends LabelData {
  structureType: StructureType;
  stage: number;
  initialized: boolean;
  level: number;
  isMine: boolean;
  hasWonder: boolean;
  owner: {
    address: bigint;
    ownerName: string;
    guildName: string;
  };
  guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
  hyperstructureRealmCount?: number;
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleTimerLeft?: number;
}

// For backward compatibility with existing StructureInfo type
export interface StructureInfoCompat {
  entityId: number;
  structureName: string;
  hexCoords: { col: number; row: number };
  structureType: StructureType;
  stage: number;
  initialized: boolean;
  level: number;
  isMine: boolean;
  hasWonder: boolean;
  owner: {
    address: bigint;
    ownerName: string;
    guildName: string;
  };
  guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
}

export const convertStructureInfo = (structure: StructureInfoCompat): StructureLabelData => {
  return {
    ...structure,
    hexCoords: new Position({ x: structure.hexCoords.col, y: structure.hexCoords.row }),
  };
};

export const StructureLabelType: LabelTypeDefinition<StructureLabelData> = {
  type: "structure",
  defaultConfig: LABEL_TYPE_CONFIGS.STRUCTURE,

  createElement: (data: StructureLabelData, inputView: CameraView): HTMLElement => {
    const cameraView = resolveCameraView(inputView);
    const mode = getGameModeConfig();
    const structureIcons = STRUCTURE_ICONS(mode.assets.labels.fragmentMine);

    // Create base label
    const labelDiv = createLabelBase(data.isMine, cameraView);
    labelDiv.style.transform = "scale(0.5)";
    labelDiv.style.transformOrigin = "center bottom";

    // Check if we have direction indicators and if view is expanded
    const hasDirections = data.attackedFromDegrees !== undefined || data.attackedTowardDegrees !== undefined;
    const isExpanded = cameraView !== CameraView.Far;

    // Create icon container
    const iconContainer = document.createElement("div");
    iconContainer.classList.add("w-auto", "h-full", "flex-shrink-0");
    iconContainer.setAttribute("data-component", "structure-icon-container");

    // Select appropriate icon
    let iconPath = structureIcons.STRUCTURES[data.structureType];
    if (data.structureType === StructureType.Realm || data.structureType === StructureType.Village) {
      iconPath = data.isMine
        ? structureIcons.MY_STRUCTURES[data.structureType]
        : structureIcons.STRUCTURES[data.structureType];
    }

    // Create and set icon image
    const iconImg = document.createElement("img");
    iconImg.src = iconPath;
    iconImg.classList.add("w-10", "h-10", "object-contain");
    iconImg.setAttribute("data-component", "structure-icon");
    iconContainer.appendChild(iconImg);

    // Create content container
    const contentContainer = createContentContainer(cameraView);

    // Add owner display
    const ownerText = createOwnerDisplayElement({
      owner: data.owner,
      isMine: data.isMine,
      cameraView,
      structureName: data.structureName,
    });

    contentContainer.appendChild(ownerText);

    // Add guard armies display
    if (Array.isArray(data.guardArmies)) {
      const guardArmiesDisplay = createGuardArmyDisplay(data.guardArmies, cameraView);
      contentContainer.appendChild(guardArmiesDisplay);
    }

    if (data.activeProductions && data.activeProductions.length > 0) {
      const productionsDisplay = createProductionDisplay(data.activeProductions, cameraView);
      contentContainer.appendChild(productionsDisplay);
    }

    // Add hyperstructure realm count display
    if (data.hyperstructureRealmCount !== undefined && data.structureType === StructureType.Hyperstructure) {
      const isOwned = data.owner && data.owner.address && data.owner.address !== 0n;

      const realmCountDisplay = document.createElement("div");
      realmCountDisplay.classList.add(
        "flex",
        "items-center",
        "gap-1.5",
        "mt-1",
        "px-2",
        "py-0.5",
        "rounded",
        "transition-all",
        "duration-300",
      );

      // Style based on ownership status
      if (isOwned) {
        realmCountDisplay.classList.add(
          "bg-order-brilliance/20",
          "border",
          "border-order-brilliance/30",
          "animate-slowPulse",
        );
      } else {
        realmCountDisplay.classList.add("/20", "border", "border-gray-600/30", "border-dashed");
      }

      realmCountDisplay.setAttribute("data-component", "realm-count");

      // Add icon based on status
      const vpIcon = document.createElement("span");
      vpIcon.classList.add("text-xs");
      if (isOwned) {
        vpIcon.textContent = "⚡";
        vpIcon.classList.add("text-order-brilliance");
      } else {
        vpIcon.textContent = "💤";
        vpIcon.classList.add("text-muted-foreground");
      }
      realmCountDisplay.appendChild(vpIcon);

      // Add the VP value
      const realmCountText = document.createElement("span");
      realmCountText.classList.add("font-bold", "text-xs");

      if (isOwned) {
        realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
      } else {
        realmCountText.classList.add("text-muted-foreground");
      }

      realmCountText.textContent = `${data.hyperstructureRealmCount}`;
      realmCountDisplay.appendChild(realmCountText);

      // Add VP/s label with status
      const vpLabel = document.createElement("span");
      vpLabel.classList.add("text-xxs", "font-normal");

      if (isOwned) {
        vpLabel.classList.add("text-order-brilliance/80");
        vpLabel.textContent = "VP/s";
      } else {
        vpLabel.classList.add("text-muted-foreground/80");
        vpLabel.textContent = "VP/s (unclaimed)";
      }

      realmCountDisplay.appendChild(vpLabel);

      contentContainer.appendChild(realmCountDisplay);
    }

    // Structure based on view and directions
    if (hasDirections && isExpanded) {
      labelDiv.classList.remove("inline-flex", "items-center");
      labelDiv.classList.add("flex", "flex-col");

      const contentRow = document.createElement("div");
      contentRow.classList.add("flex", "items-center");
      contentRow.setAttribute("data-component", "structure-content-row");
      contentRow.appendChild(iconContainer);
      contentRow.appendChild(contentContainer.wrapper);
      labelDiv.appendChild(contentRow);

      const directionIndicators = createDirectionIndicators(
        data.attackedFromDegrees,
        data.attackedTowardDegrees,
        data.battleTimerLeft,
      );

      attachDirectionIndicators(labelDiv, directionIndicators, cameraView);
    } else {
      labelDiv.appendChild(iconContainer);
      labelDiv.appendChild(contentContainer.wrapper);

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

  updateElement: (element: HTMLElement, data: StructureLabelData, inputView: CameraView): void => {
    const cameraView = resolveCameraView(inputView);
    const mode = getGameModeConfig();
    const structureIcons = STRUCTURE_ICONS(mode.assets.labels.fragmentMine);

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
    const styles = getOwnershipStyle(data.isMine);
    element.style.setProperty("background-color", styles.default.backgroundColor!, "important");
    element.style.setProperty("border", `1px solid ${styles.default.borderColor}`, "important");
    element.style.setProperty("color", styles.default.textColor!, "important");

    element.onmouseenter = () => {
      element.style.setProperty("background-color", styles.hover.backgroundColor!, "important");
    };

    element.onmouseleave = () => {
      element.style.setProperty("background-color", styles.default.backgroundColor!, "important");
    };

    // Update structure icon based on ownership
    const structureIcon = element.querySelector('[data-component="structure-icon"]') as HTMLImageElement;
    if (structureIcon) {
      let iconPath = structureIcons.STRUCTURES[data.structureType];
      if (data.structureType === StructureType.Realm || data.structureType === StructureType.Village) {
        iconPath = data.isMine
          ? structureIcons.MY_STRUCTURES[data.structureType]
          : structureIcons.STRUCTURES[data.structureType];
      }
      structureIcon.src = iconPath;
    }

    const iconContainer = element.querySelector('[data-component="structure-icon-container"]');
    const contentWrapper = element.querySelector('[data-component="content-container-wrapper"]') as HTMLElement | null;
    const contentContainer = element.querySelector('[data-component="content-container"]') as HTMLElement | null;
    let structureContentRow = element.querySelector('[data-component="structure-content-row"]');

    const directionIndicatorsEl = element.querySelector('[data-component="direction-indicators"]');

    if (hasDirections && isExpanded) {
      if (!structureContentRow && iconContainer && contentWrapper) {
        const newContentRow = document.createElement("div");
        newContentRow.classList.add("flex", "items-center");
        newContentRow.setAttribute("data-component", "structure-content-row");

        if (iconContainer.parentElement) {
          iconContainer.parentElement.removeChild(iconContainer);
        }
        if (contentWrapper.parentElement) {
          contentWrapper.parentElement.removeChild(contentWrapper);
        }

        newContentRow.appendChild(iconContainer);
        newContentRow.appendChild(contentWrapper);

        if (directionIndicatorsEl) {
          element.insertBefore(newContentRow, directionIndicatorsEl);
        } else {
          element.appendChild(newContentRow);
        }

        structureContentRow = newContentRow;
      }
    } else {
      if (structureContentRow) {
        structureContentRow.remove();
        structureContentRow = null;
      }

      const placeBeforeDirections = (node: HTMLElement | null) => {
        if (!node) return;
        if (node.parentElement) {
          node.parentElement.removeChild(node);
        }
        if (directionIndicatorsEl) {
          element.insertBefore(node, directionIndicatorsEl);
        } else {
          element.appendChild(node);
        }
      };

      placeBeforeDirections(iconContainer as HTMLElement | null);
      placeBeforeDirections(contentWrapper as HTMLElement | null);
    }

    const guardDisplay = element.querySelector('[data-component="guard-armies"]');
    if (Array.isArray(data.guardArmies)) {
      if (guardDisplay) {
        updateGuardArmyDisplay(guardDisplay as HTMLElement, data.guardArmies, cameraView);
      } else if (contentContainer) {
        const newGuardDisplay = createGuardArmyDisplay(data.guardArmies, cameraView);
        const ownerNode = contentContainer.querySelector('[data-component="owner"]');
        if (ownerNode && ownerNode.parentElement === contentContainer) {
          contentContainer.insertBefore(newGuardDisplay, ownerNode.nextSibling);
        } else {
          contentContainer.appendChild(newGuardDisplay);
        }
      }
    } else if (guardDisplay) {
      guardDisplay.remove();
    }

    const ownerDisplay = element.querySelector('[data-component="owner"]');
    if (ownerDisplay) {
      const updatedOwnerDisplay = createOwnerDisplayElement({
        owner: data.owner,
        isMine: data.isMine,
        cameraView,
        structureName: data.structureName,
      });

      ownerDisplay.replaceWith(updatedOwnerDisplay);
    }

    // Update active productions display
    const productionsDisplay = element.querySelector('[data-component="productions"]');
    if (productionsDisplay) {
      updateProductionDisplay(productionsDisplay as HTMLElement, data.activeProductions ?? [], cameraView);
    }

    // Update hyperstructure realm count
    const realmCountDisplay = element.querySelector('[data-component="realm-count"]');
    if (data.hyperstructureRealmCount !== undefined && data.structureType === StructureType.Hyperstructure) {
      const isOwned = data.owner && data.owner.address && data.owner.address !== 0n;

      if (realmCountDisplay) {
        const vpIcon = realmCountDisplay.querySelector("span:first-child");
        const realmCountText = realmCountDisplay.querySelector("span.font-bold");
        const vpLabel = realmCountDisplay.querySelector("span:last-child");

        if (vpIcon && realmCountText && vpLabel) {
          if (isOwned) {
            vpIcon.textContent = "⚡";
            vpIcon.className = "text-xs text-order-brilliance";
          } else {
            vpIcon.textContent = "💤";
            vpIcon.className = "text-xs text-muted-foreground";
          }

          realmCountText.textContent = `${data.hyperstructureRealmCount}`;
          realmCountText.className = "font-bold text-xs";
          if (isOwned) {
            realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
          } else {
            realmCountText.classList.add("text-muted-foreground");
          }

          vpLabel.className = "text-xxs font-normal";
          if (isOwned) {
            vpLabel.classList.add("text-order-brilliance/80");
            vpLabel.textContent = "VP/s";
          } else {
            vpLabel.classList.add("text-muted-foreground/80");
            vpLabel.textContent = "VP/s (unclaimed)";
          }

          realmCountDisplay.className =
            "flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded transition-all duration-300";
          if (isOwned) {
            realmCountDisplay.classList.add(
              "bg-order-brilliance/20",
              "border",
              "border-order-brilliance/30",
              "animate-slowPulse",
            );
          } else {
            realmCountDisplay.classList.add("/20", "border", "border-gray-600/30", "border-dashed");
          }
        }
      } else {
        const newRealmCountDisplay = document.createElement("div");
        newRealmCountDisplay.classList.add(
          "flex",
          "items-center",
          "gap-1.5",
          "mt-1",
          "px-2",
          "py-0.5",
          "rounded",
          "transition-all",
          "duration-300",
        );

        if (isOwned) {
          newRealmCountDisplay.classList.add(
            "bg-order-brilliance/20",
            "border",
            "border-order-brilliance/30",
            "animate-slowPulse",
          );
        } else {
          newRealmCountDisplay.classList.add("/20", "border", "border-gray-600/30", "border-dashed");
        }

        newRealmCountDisplay.setAttribute("data-component", "realm-count");

        const vpIcon = document.createElement("span");
        vpIcon.classList.add("text-xs");
        if (isOwned) {
          vpIcon.textContent = "⚡";
          vpIcon.classList.add("text-order-brilliance");
        } else {
          vpIcon.textContent = "💤";
          vpIcon.classList.add("text-muted-foreground");
        }
        newRealmCountDisplay.appendChild(vpIcon);

        const realmCountText = document.createElement("span");
        realmCountText.classList.add("font-bold", "text-xs");

        if (isOwned) {
          realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
        } else {
          realmCountText.classList.add("text-muted-foreground");
        }

        realmCountText.textContent = `${data.hyperstructureRealmCount}`;
        newRealmCountDisplay.appendChild(realmCountText);

        const vpLabel = document.createElement("span");
        vpLabel.classList.add("text-xxs", "font-normal");

        if (isOwned) {
          vpLabel.classList.add("text-order-brilliance/80");
          vpLabel.textContent = "VP/s";
        } else {
          vpLabel.classList.add("text-muted-foreground/80");
          vpLabel.textContent = "VP/s (unclaimed)";
        }

        newRealmCountDisplay.appendChild(vpLabel);

        const contentContainer = element.querySelector('[data-component="content-container"]');
        if (contentContainer) {
          contentContainer.appendChild(newRealmCountDisplay);
        }
      }
    } else if (realmCountDisplay) {
      realmCountDisplay.remove();
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
