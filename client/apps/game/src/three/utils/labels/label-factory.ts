import { Position } from "@bibliothecadao/eternum";

import { getIsBlitz } from "@bibliothecadao/eternum";

import { getCharacterName } from "@/utils/agent";
import { BuildingType, Direction, ResourcesIds, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { CameraView } from "../../scenes/hexagon-scene";
import {
  createContentContainer,
  createDirectionIndicators,
  createGuardArmyDisplay,
  createOwnerDisplayElement,
  createProductionDisplay,
  createStaminaBar,
  createTroopCountDisplay,
  updateDirectionIndicators,
  updateStaminaBar,
} from "./label-components";
import { getOwnershipStyle, LABEL_STYLES, LABEL_TYPE_CONFIGS } from "./label-config";
import { LabelData, LabelTypeDefinition } from "./label-types";

/**
 * Structure icon paths
 */
const STRUCTURE_ICONS = (isBlitz: boolean) => ({
  STRUCTURES: {
    [StructureType.Village]: "/images/labels/enemy_village.png",
    [StructureType.Realm]: "/images/labels/enemy_realm.png",
    [StructureType.Hyperstructure]: "/images/labels/hyperstructure.png",
    [StructureType.Bank]: `/images/resources/${ResourcesIds.Lords}.png`, // Lords resource ID
    [StructureType.FragmentMine]: isBlitz ? "/images/labels/essence_rift.png" : "/images/labels/fragment_mine.png",
  } as Record<StructureType, string>,
  MY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/village.png",
    [StructureType.Realm]: "/images/labels/realm.png",
  } as Record<StructureType, string>,
  ALLY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/allies_village.png",
    [StructureType.Realm]: "/images/labels/allies_realm.png",
  } as Record<StructureType, string>,
});

/**
 * Extended label data interfaces
 */
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
  attackedFromDirection?: Direction; // Direction from which this army has been attacked
  attackedTowardDirection?: Direction; // Direction in which this army has attacked someone
  battleTimerLeft?: number; // Time left in seconds before battle penalty is over
}

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
  attackedFromDirection?: Direction; // Direction from which this structure has been attacked
  attackedTowardDirection?: Direction; // Direction in which this structure has attacked someone
  battleTimerLeft?: number; // Time left in seconds before battle penalty is over
}

// For backward compatibility with existing StructureInfo type
export interface StructureInfoCompat {
  entityId: number;
  hexCoords: { col: number; row: number }; // Different from Position
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

export interface ChestLabelData extends LabelData {
  // Chests have minimal data
}

export interface QuestLabelData extends LabelData {
  questType: number; // QuestType enum value
  occupierId: number;
}

/**
 * Create base label element with common properties
 */
const createLabelBase = (isMine: boolean, isDaydreamsAgent?: boolean): HTMLElement => {
  const labelDiv = document.createElement("div");

  // Add common classes
  labelDiv.classList.add(
    "rounded-md",
    "p-0.5",
    "-translate-x-1/2",
    "text-xxs",
    "flex",
    "items-center",
    "group",
    "shadow-md",
    "font-semibold",
    "transition-[height]",
    "duration-700",
    "ease-in-out",
    "h-auto",
    "has-[.opacity-0]:h-12",
  );

  // Get appropriate style
  const styles = getOwnershipStyle(isMine, isDaydreamsAgent);

  // Apply styles directly
  labelDiv.style.setProperty("background-color", styles.default.backgroundColor!, "important");
  labelDiv.style.setProperty("border", `1px solid ${styles.default.borderColor}`, "important");
  labelDiv.style.setProperty("color", styles.default.textColor!, "important");

  // Add hover effect
  labelDiv.addEventListener("mouseenter", () => {
    labelDiv.style.setProperty("background-color", styles.hover.backgroundColor!, "important");
  });

  labelDiv.addEventListener("mouseleave", () => {
    labelDiv.style.setProperty("background-color", styles.default.backgroundColor!, "important");
  });

  // Prevent right click
  labelDiv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  return labelDiv;
};

/**
 * Army label type definition
 */
export const ArmyLabelType: LabelTypeDefinition<ArmyLabelData> = {
  type: "army",
  defaultConfig: LABEL_TYPE_CONFIGS.ARMY,

  createElement: (data: ArmyLabelData, cameraView: CameraView): HTMLElement => {
    // Create base label
    const labelDiv = createLabelBase(data.isMine, data.isDaydreamsAgent);

    // Add army icon
    const img = document.createElement("img");
    img.src = data.isDaydreamsAgent
      ? "/images/logos/daydreams.png"
      : `/images/labels/${data.isMine ? "army" : "enemy_army"}.png`;
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    img.setAttribute("data-component", "army-icon");
    labelDiv.appendChild(img);

    // Create content container
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
    if (data.troopCount !== undefined) {
      const troopCountDisplay = createTroopCountDisplay(data.troopCount, data.category, data.tier);
      textContainer.appendChild(troopCountDisplay);
    }

    // Add stamina bar
    if (data.currentStamina !== undefined && data.maxStamina !== undefined && data.maxStamina > 0) {
      const staminaBar = createStaminaBar(data.currentStamina, data.maxStamina);
      textContainer.appendChild(staminaBar);
    } else if (data.currentStamina !== undefined) {
      // Show just current stamina if max is not available
      const staminaInfo = document.createElement("div");
      staminaInfo.classList.add("flex", "items-center", "text-xxs", "gap-1");

      const staminaIcon = document.createElement("span");
      staminaIcon.textContent = "⚡";
      staminaIcon.classList.add("text-yellow-400");
      staminaInfo.appendChild(staminaIcon);

      const staminaText = document.createElement("span");
      staminaText.textContent = `${data.currentStamina}`;
      staminaText.classList.add("text-white", "font-mono");
      staminaInfo.appendChild(staminaText);

      textContainer.appendChild(staminaInfo);
    }

    // Add direction indicators
    const directionIndicators = createDirectionIndicators(data.attackedFromDirection, data.attackedTowardDirection, data.battleTimerLeft);
    if (directionIndicators) {
      textContainer.appendChild(directionIndicators);
    }

    labelDiv.appendChild(textContainer.wrapper);
    return labelDiv;
  },

  updateElement: (element: HTMLElement, data: ArmyLabelData, cameraView: CameraView): void => {
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

    // Update army icon based on ownership
    const armyIcon = element.querySelector('[data-component="army-icon"]') as HTMLImageElement;
    if (armyIcon) {
      armyIcon.src = data.isDaydreamsAgent
        ? "/images/logos/daydreams.png"
        : `/images/labels/${data.isMine ? "army" : "enemy_army"}.png`;
    }

    // Update troop count if present
    const troopCountElement = element.querySelector('[data-component="troop-count"] [data-role="count"]');
    if (troopCountElement && data.troopCount !== undefined) {
      troopCountElement.textContent = data.troopCount.toString();
    }

    // Update stamina bar if present
    const staminaBar = element.querySelector('[data-component="stamina-bar"]');
    if (staminaBar && data.currentStamina !== undefined && data.maxStamina !== undefined) {
      updateStaminaBar(staminaBar as HTMLElement, data.currentStamina, data.maxStamina);
    }

    // Update direction indicators
    updateDirectionIndicators(element, data.attackedFromDirection, data.attackedTowardDirection, data.battleTimerLeft);
  },
};

/**
 * Structure label type definition
 */
export const StructureLabelType: LabelTypeDefinition<StructureLabelData> = {
  type: "structure",
  defaultConfig: LABEL_TYPE_CONFIGS.STRUCTURE,

  createElement: (data: StructureLabelData, cameraView: CameraView): HTMLElement => {
    const isBlitz = getIsBlitz();

    // Create base label
    const labelDiv = createLabelBase(data.isMine);

    // Create icon container
    const iconContainer = document.createElement("div");
    iconContainer.classList.add("w-auto", "h-full", "flex-shrink-0");

    // Select appropriate icon
    let iconPath = STRUCTURE_ICONS(isBlitz).STRUCTURES[data.structureType];
    if (data.structureType === StructureType.Realm || data.structureType === StructureType.Village) {
      iconPath = data.isMine
        ? STRUCTURE_ICONS(isBlitz).MY_STRUCTURES[data.structureType]
        : STRUCTURE_ICONS(isBlitz).STRUCTURES[data.structureType];
    }

    // Create and set icon image
    const iconImg = document.createElement("img");
    iconImg.src = iconPath;
    iconImg.classList.add("w-10", "h-10", "object-contain");
    iconImg.setAttribute("data-component", "structure-icon");
    iconContainer.appendChild(iconImg);
    labelDiv.appendChild(iconContainer);

    // Create content container
    const contentContainer = createContentContainer(cameraView);

    // Add owner display
    const ownerText = createOwnerDisplayElement({
      owner: data.owner,
      isMine: data.isMine,
      cameraView,
    });

    contentContainer.appendChild(ownerText);

    // Add guard armies display
    if (data.guardArmies && data.guardArmies.length > 0) {
      const guardArmiesDisplay = createGuardArmyDisplay(data.guardArmies);
      contentContainer.appendChild(guardArmiesDisplay);
    }

    // Add active productions display
    if (data.activeProductions && data.activeProductions.length > 0) {
      const productionsDisplay = createProductionDisplay(data.activeProductions);
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
        // Active/earning style
        realmCountDisplay.classList.add(
          "bg-order-brilliance/20",
          "border",
          "border-order-brilliance/30",
          "animate-slowPulse",
        );
      } else {
        // Inactive/unclaimed style
        realmCountDisplay.classList.add("bg-gray-700/20", "border", "border-gray-600/30", "border-dashed");
      }

      realmCountDisplay.setAttribute("data-component", "realm-count");

      // Add icon based on status
      const vpIcon = document.createElement("span");
      vpIcon.classList.add("text-xs");
      if (isOwned) {
        vpIcon.textContent = "⚡"; // Lightning for active
        vpIcon.classList.add("text-order-brilliance");
      } else {
        vpIcon.textContent = "💤"; // Sleeping for inactive
        vpIcon.classList.add("text-gray-300");
      }
      realmCountDisplay.appendChild(vpIcon);

      // Add the VP value
      const realmCountText = document.createElement("span");
      realmCountText.classList.add("font-bold", "text-xs");

      if (isOwned) {
        realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
      } else {
        realmCountText.classList.add("text-gray-300");
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
        vpLabel.classList.add("text-gray-300");
        vpLabel.textContent = "VP/s (unclaimed)";
      }

      realmCountDisplay.appendChild(vpLabel);

      contentContainer.appendChild(realmCountDisplay);
    }

    // Add direction indicators
    const directionIndicators = createDirectionIndicators(data.attackedFromDirection, data.attackedTowardDirection, data.battleTimerLeft);
    if (directionIndicators) {
      contentContainer.appendChild(directionIndicators);
    }

    labelDiv.appendChild(contentContainer.wrapper);
    return labelDiv;
  },

  updateElement: (element: HTMLElement, data: StructureLabelData, cameraView: CameraView): void => {
    const isBlitz = getIsBlitz();

    // Update container colors based on ownership
    const styles = getOwnershipStyle(data.isMine);
    element.style.setProperty("background-color", styles.default.backgroundColor!, "important");
    element.style.setProperty("border", `1px solid ${styles.default.borderColor}`, "important");
    element.style.setProperty("color", styles.default.textColor!, "important");

    // Update hover effect
    element.onmouseenter = () => {
      element.style.setProperty("background-color", styles.hover.backgroundColor!, "important");
    };

    element.onmouseleave = () => {
      element.style.setProperty("background-color", styles.default.backgroundColor!, "important");
    };

    // Update structure icon based on ownership
    const structureIcon = element.querySelector('[data-component="structure-icon"]') as HTMLImageElement;
    if (structureIcon) {
      let iconPath = STRUCTURE_ICONS(isBlitz).STRUCTURES[data.structureType];
      if (data.structureType === StructureType.Realm || data.structureType === StructureType.Village) {
        iconPath = data.isMine
          ? STRUCTURE_ICONS(isBlitz).MY_STRUCTURES[data.structureType]
          : STRUCTURE_ICONS(isBlitz).STRUCTURES[data.structureType];
      }
      structureIcon.src = iconPath;
    }

    // Update guard armies display
    const guardDisplay = element.querySelector('[data-component="guard-armies"]');
    if (guardDisplay && data.guardArmies) {
      const newGuardDisplay = createGuardArmyDisplay(data.guardArmies);
      guardDisplay.innerHTML = "";
      while (newGuardDisplay.firstChild) {
        guardDisplay.appendChild(newGuardDisplay.firstChild);
      }
    }

    const ownerText = element.querySelector('[data-component="owner"]');
    if (ownerText) {
      ownerText.textContent = data.owner.ownerName;
    }

    // Update active productions display
    const productionsDisplay = element.querySelector('[data-component="productions"]');
    if (productionsDisplay && data.activeProductions) {
      const newProductionsDisplay = createProductionDisplay(data.activeProductions);
      productionsDisplay.innerHTML = "";
      while (newProductionsDisplay.firstChild) {
        productionsDisplay.appendChild(newProductionsDisplay.firstChild);
      }
    }

    // Update hyperstructure realm count
    const realmCountDisplay = element.querySelector('[data-component="realm-count"]');
    if (data.hyperstructureRealmCount !== undefined && data.structureType === StructureType.Hyperstructure) {
      const isOwned = data.owner && data.owner.address && data.owner.address !== 0n;

      if (realmCountDisplay) {
        // Update existing display
        const vpIcon = realmCountDisplay.querySelector("span:first-child");
        const realmCountText = realmCountDisplay.querySelector("span.font-bold");
        const vpLabel = realmCountDisplay.querySelector("span:last-child");

        if (vpIcon && realmCountText && vpLabel) {
          // Update icon
          if (isOwned) {
            vpIcon.textContent = "⚡";
            vpIcon.className = "text-xs text-order-brilliance";
          } else {
            vpIcon.textContent = "💤";
            vpIcon.className = "text-xs text-gray-300";
          }

          // Update count
          realmCountText.textContent = `${data.hyperstructureRealmCount}`;
          realmCountText.className = "font-bold text-xs";
          if (isOwned) {
            realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
          } else {
            realmCountText.classList.add("text-gray-300");
          }

          // Update label
          vpLabel.className = "text-xxs font-normal";
          if (isOwned) {
            vpLabel.classList.add("text-order-brilliance/80");
            vpLabel.textContent = "VP/s";
          } else {
            vpLabel.classList.add("text-gray-300");
            vpLabel.textContent = "VP/s (unclaimed)";
          }

          // Update container styles
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
            realmCountDisplay.classList.add("bg-gray-700/20", "border", "border-gray-600/30", "border-dashed");
          }
        }
      } else {
        // Create new realm count display if it doesn't exist
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
          newRealmCountDisplay.classList.add("bg-gray-700/20", "border", "border-gray-600/30", "border-dashed");
        }

        newRealmCountDisplay.setAttribute("data-component", "realm-count");

        // Add icon
        const vpIcon = document.createElement("span");
        vpIcon.classList.add("text-xs");
        if (isOwned) {
          vpIcon.textContent = "⚡";
          vpIcon.classList.add("text-order-brilliance");
        } else {
          vpIcon.textContent = "💤";
          vpIcon.classList.add("text-gray-300");
        }
        newRealmCountDisplay.appendChild(vpIcon);

        // Add the VP value
        const realmCountText = document.createElement("span");
        realmCountText.classList.add("font-bold", "text-xs");

        if (isOwned) {
          realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
        } else {
          realmCountText.classList.add("text-gray-300");
        }

        realmCountText.textContent = `${data.hyperstructureRealmCount}`;
        newRealmCountDisplay.appendChild(realmCountText);

        // Add VP/s label
        const vpLabel = document.createElement("span");
        vpLabel.classList.add("text-xxs", "font-normal");

        if (isOwned) {
          vpLabel.classList.add("text-order-brilliance/80");
          vpLabel.textContent = "VP/s";
        } else {
          vpLabel.classList.add("text-gray-300");
          vpLabel.textContent = "VP/s (unclaimed)";
        }

        newRealmCountDisplay.appendChild(vpLabel);

        const contentContainer = element.querySelector('[data-component="content-container"]');
        if (contentContainer) {
          contentContainer.appendChild(newRealmCountDisplay);
        }
      }
    } else if (realmCountDisplay) {
      // Remove realm count display if no longer needed
      realmCountDisplay.remove();
    }

    // Update direction indicators
    updateDirectionIndicators(element, data.attackedFromDirection, data.attackedTowardDirection, data.battleTimerLeft);
  },
};

/**
 * Chest label type definition
 */
export const ChestLabelType: LabelTypeDefinition<ChestLabelData> = {
  type: "chest",
  defaultConfig: LABEL_TYPE_CONFIGS.CHEST,

  createElement: (data: ChestLabelData, cameraView: CameraView): HTMLElement => {
    // Create base label with chest styling
    const labelDiv = createLabelBase(false); // Chests don't have ownership

    // Override text color for chests
    labelDiv.style.setProperty("color", LABEL_STYLES.CHEST.textColor!, "important");
    labelDiv.style.setProperty("background-color", LABEL_STYLES.CHEST.backgroundColor!, "important");
    labelDiv.style.setProperty("border-color", LABEL_STYLES.CHEST.borderColor!, "important");

    // Add chest icon
    const img = document.createElement("img");
    img.src = "/images/labels/chest.png";
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    img.setAttribute("data-component", "chest-icon");
    labelDiv.appendChild(img);

    // Create content container
    const contentContainer = createContentContainer(cameraView);

    // Add chest label
    const line1 = document.createElement("span");
    line1.textContent = "Chest";
    line1.style.color = "inherit";
    contentContainer.appendChild(line1);

    labelDiv.appendChild(contentContainer.wrapper);
    return labelDiv;
  },

  // Chests don't need updates
  updateElement: undefined,
};

/**
 * Quest label type definition
 */
export const QuestLabelType: LabelTypeDefinition<QuestLabelData> = {
  type: "quest",
  defaultConfig: {
    ...LABEL_TYPE_CONFIGS.CHEST, // Similar to chest positioning
    positionOffset: { x: 0, y: 1.5, z: 0 },
  },

  createElement: (data: QuestLabelData, cameraView: CameraView): HTMLElement => {
    // Create base label with quest styling
    const labelDiv = createLabelBase(false); // Quests don't have ownership

    // Override text color for quests (gold)
    labelDiv.style.setProperty("color", "#fbbf24", "important");
    labelDiv.style.setProperty("background-color", "rgba(251, 191, 36, 0.3)", "important");
    labelDiv.style.setProperty("border-color", "rgba(245, 158, 11, 0.5)", "important");

    // Add quest icon
    const img = document.createElement("img");
    img.src = "/images/labels/quest.png";
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    img.setAttribute("data-component", "quest-icon");
    labelDiv.appendChild(img);

    // Create content container
    const contentContainer = createContentContainer(cameraView);

    // Add quest label
    const line1 = document.createElement("span");
    line1.textContent = "Quest";
    line1.style.color = "inherit";
    contentContainer.appendChild(line1);

    labelDiv.appendChild(contentContainer.wrapper);
    return labelDiv;
  },

  // Quests don't need updates
  updateElement: undefined,
};

/**
 * Factory function to create label type definitions with custom configurations
 */
export function createCustomLabelType<T extends LabelData = LabelData>(
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

// Helper function to convert StructureInfoCompat to StructureLabelData
const convertStructureInfo = (structure: StructureInfoCompat): StructureLabelData => {
  return {
    ...structure,
    hexCoords: new Position({ x: structure.hexCoords.col, y: structure.hexCoords.row }),
  };
};

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

export const createQuestLabel = (quest: QuestLabelData, cameraView: CameraView): HTMLElement => {
  return QuestLabelType.createElement(quest, cameraView);
};
