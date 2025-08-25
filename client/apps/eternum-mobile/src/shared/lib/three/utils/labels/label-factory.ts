import { getIsBlitz } from "@bibliothecadao/eternum";
import { BuildingType, ResourcesIds, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import {
  createContentContainer,
  createGuardArmyDisplay,
  createOwnerDisplayElement,
  createProductionDisplay,
  createStaminaBar,
  getTierStyle,
  getTroopResourceIdFromCategory,
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
    [StructureType.Bank]: `/images/resources/${ResourcesIds.Lords}.png`,
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
}

export interface ChestLabelData extends LabelData {
  // Chests have minimal data
}

export interface QuestLabelData extends LabelData {
  questType: number;
  occupierId: number;
}

/**
 * Convert TroopTier enum to number for styling
 */
const getTierNumber = (tier: TroopTier): number => {
  switch (tier) {
    case TroopTier.T1:
      return 1;
    case TroopTier.T2:
      return 2;
    case TroopTier.T3:
      return 3;
    default:
      return 1;
  }
};

/**
 * Create troop icon display for army labels
 */
const createTroopIconDisplay = (troopCount: number, troopType: TroopType, troopTier: TroopTier): HTMLElement => {
  const troopDisplay = document.createElement("div");
  troopDisplay.classList.add("flex", "items-center", "gap-0.5", "rounded", "px-1", "py-0.5", "bg-black/40");
  troopDisplay.setAttribute("data-component", "troop-icon");

  const troopTypeName = troopType.toString();
  const resourceId = getTroopResourceIdFromCategory(troopTypeName);

  if (resourceId) {
    const iconContainer = document.createElement("div");
    iconContainer.classList.add("w-3", "h-3", "flex-shrink-0");

    const img = document.createElement("img");
    img.src = `/images/resources/${resourceId}.png`;
    img.classList.add("w-full", "h-full", "object-contain");
    iconContainer.appendChild(img);
    troopDisplay.appendChild(iconContainer);
  }

  const countSpan = document.createElement("span");
  countSpan.textContent = troopCount.toString();
  countSpan.classList.add("font-semibold", "text-xxs", "leading-none");
  countSpan.setAttribute("data-role", "count");
  troopDisplay.appendChild(countSpan);

  const tierBadge = document.createElement("span");
  tierBadge.textContent = `T${getTierNumber(troopTier)}`;
  tierBadge.classList.add(
    "px-0.5",
    "py-0",
    "rounded",
    "text-[9px]",
    "font-bold",
    "border",
    "leading-none",
    ...getTierStyle(getTierNumber(troopTier)).split(" "),
  );
  troopDisplay.appendChild(tierBadge);

  return troopDisplay;
};

/**
 * Create base label element with common properties
 */
const createLabelBase = (isMine: boolean, isDaydreamsAgent?: boolean): HTMLElement => {
  const labelDiv = document.createElement("div");

  // Add common classes
  labelDiv.classList.add(
    "rounded",
    "p-0.5",
    "-translate-x-1/2",
    "text-xxs",
    "flex",
    "items-center",
    "group",
    "shadow-sm",
    "font-semibold",
    "transition-[height]",
    "duration-300",
    "ease-in-out",
    "h-auto",
    "leading-none",
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

  createElement: (data: ArmyLabelData): HTMLElement => {
    // Create base label
    const labelDiv = createLabelBase(data.isMine, data.isDaydreamsAgent);

    // Add army icon
    const img = document.createElement("img");
    img.src = data.isDaydreamsAgent
      ? "/images/logos/daydreams.png"
      : `/images/labels/${data.isMine ? "army" : "enemy_army"}.png`;
    img.classList.add("w-6", "h-6", "inline-block", "object-contain", "flex-shrink-0");
    img.setAttribute("data-component", "army-icon");
    labelDiv.appendChild(img);

    // Create content container
    const textContainer = createContentContainer();

    // Add owner information
    const ownerDisplay = createOwnerDisplayElement({
      owner: data.owner,
      isMine: data.isMine,
      color: data.color,
      isDaydreamsAgent: data.isDaydreamsAgent,
    });
    textContainer.appendChild(ownerDisplay);

    // Add troop icon display
    if (data.troopCount !== undefined) {
      const troopIconDisplay = createTroopIconDisplay(data.troopCount, data.category, data.tier);
      textContainer.appendChild(troopIconDisplay);
    }

    // Add stamina bar
    if (data.currentStamina !== undefined && data.maxStamina !== undefined && data.maxStamina > 0) {
      const staminaBar = createStaminaBar(data.currentStamina, data.maxStamina);
      textContainer.appendChild(staminaBar);
    } else if (data.currentStamina !== undefined) {
      // Show just current stamina if max is not available
      const staminaInfo = document.createElement("div");
      staminaInfo.classList.add("flex", "items-center", "text-xxs", "gap-0.5", "leading-none");

      const staminaIcon = document.createElement("span");
      staminaIcon.textContent = "⚡";
      staminaIcon.classList.add("text-yellow-400");
      staminaInfo.appendChild(staminaIcon);

      const staminaText = document.createElement("span");
      staminaText.textContent = `${data.currentStamina}`;
      staminaText.classList.add("text-white", "font-mono", "text-xxs", "leading-none");
      staminaInfo.appendChild(staminaText);

      textContainer.appendChild(staminaInfo);
    }

    labelDiv.appendChild(textContainer.wrapper);
    return labelDiv;
  },

  updateElement: (element: HTMLElement, data: ArmyLabelData): void => {
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

    // Update troop icon display if present
    const troopIconElement = element.querySelector('[data-component="troop-icon"]');
    if (troopIconElement && data.troopCount !== undefined) {
      // Update the count
      const countElement = troopIconElement.querySelector('[data-role="count"]');
      if (countElement) {
        countElement.textContent = data.troopCount.toString();
      }

      // Update the icon if troop type changed
      const iconContainer = troopIconElement.querySelector("div:first-child");
      const img = iconContainer?.querySelector("img");
      if (img) {
        const troopTypeName = data.category.toString();
        const resourceId = getTroopResourceIdFromCategory(troopTypeName);
        if (resourceId) {
          img.src = `/images/resources/${resourceId}.png`;
        }
      }

      // Update the tier badge
      const tierBadge = troopIconElement.querySelector("span:last-child");
      if (tierBadge) {
        tierBadge.textContent = `T${getTierNumber(data.tier)}`;
        tierBadge.className = `px-0.5 py-0 rounded text-[9px] font-bold border leading-none ${getTierStyle(getTierNumber(data.tier))}`;
      }
    }

    // Update stamina bar if present
    const staminaBar = element.querySelector('[data-component="stamina-bar"]');
    if (staminaBar && data.currentStamina !== undefined && data.maxStamina !== undefined) {
      updateStaminaBar(staminaBar as HTMLElement, data.currentStamina, data.maxStamina);
    }
  },
};

/**
 * Structure label type definition
 */
export const StructureLabelType: LabelTypeDefinition<StructureLabelData> = {
  type: "structure",
  defaultConfig: LABEL_TYPE_CONFIGS.STRUCTURE,

  createElement: (data: StructureLabelData): HTMLElement => {
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
    iconImg.classList.add("w-6", "h-6", "object-contain", "flex-shrink-0");
    iconImg.setAttribute("data-component", "structure-icon");
    iconContainer.appendChild(iconImg);
    labelDiv.appendChild(iconContainer);

    // Create content container
    const contentContainer = createContentContainer();

    // Add owner display
    const ownerText = createOwnerDisplayElement({
      owner: data.owner,
      isMine: data.isMine,
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
        "gap-1",
        "px-1.5",
        "py-0.5",
        "rounded",
        "transition-all",
        "duration-300",
        "leading-none",
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
      vpIcon.classList.add("text-xxs", "leading-none");
      if (isOwned) {
        vpIcon.textContent = "⚡";
        vpIcon.classList.add("text-order-brilliance");
      } else {
        vpIcon.textContent = "💤";
        vpIcon.classList.add("text-gray-300");
      }
      realmCountDisplay.appendChild(vpIcon);

      // Add the VP value
      const realmCountText = document.createElement("span");
      realmCountText.classList.add("font-bold", "text-xxs", "leading-none");

      if (isOwned) {
        realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
      } else {
        realmCountText.classList.add("text-gray-300");
      }

      realmCountText.textContent = `${data.hyperstructureRealmCount}`;
      realmCountDisplay.appendChild(realmCountText);

      // Add VP/s label with status
      const vpLabel = document.createElement("span");
      vpLabel.classList.add("text-xxs", "font-normal", "leading-none");

      if (isOwned) {
        vpLabel.classList.add("text-order-brilliance/80");
        vpLabel.textContent = "VP/s";
      } else {
        vpLabel.classList.add("text-gray-300");
        vpLabel.textContent = "unclaimed";
      }

      realmCountDisplay.appendChild(vpLabel);

      contentContainer.appendChild(realmCountDisplay);
    }

    labelDiv.appendChild(contentContainer.wrapper);
    return labelDiv;
  },

  updateElement: (element: HTMLElement, data: StructureLabelData): void => {
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
            vpIcon.className = "text-xxs leading-none text-order-brilliance";
          } else {
            vpIcon.textContent = "💤";
            vpIcon.className = "text-xxs leading-none text-gray-300";
          }

          // Update count
          realmCountText.textContent = `${data.hyperstructureRealmCount}`;
          realmCountText.className = "font-bold text-xxs leading-none";
          if (isOwned) {
            realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
          } else {
            realmCountText.classList.add("text-gray-300");
          }

          // Update label
          vpLabel.className = "text-xxs font-normal leading-none";
          if (isOwned) {
            vpLabel.classList.add("text-order-brilliance/80");
            vpLabel.textContent = "VP/s";
          } else {
            vpLabel.classList.add("text-gray-300");
            vpLabel.textContent = "unclaimed";
          }

          // Update container styles
          realmCountDisplay.className =
            "flex items-center gap-1 px-1.5 py-0.5 rounded transition-all duration-300 leading-none";
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
          "gap-1",
          "px-1.5",
          "py-0.5",
          "rounded",
          "transition-all",
          "duration-300",
          "leading-none",
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
        vpIcon.classList.add("text-xxs", "leading-none");
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
        realmCountText.classList.add("font-bold", "text-xxs", "leading-none");

        if (isOwned) {
          realmCountText.classList.add("text-order-brilliance", "text-shadow-glow-brilliance-xs");
        } else {
          realmCountText.classList.add("text-gray-300");
        }

        realmCountText.textContent = `${data.hyperstructureRealmCount}`;
        newRealmCountDisplay.appendChild(realmCountText);

        // Add VP/s label
        const vpLabel = document.createElement("span");
        vpLabel.classList.add("text-xxs", "font-normal", "leading-none");

        if (isOwned) {
          vpLabel.classList.add("text-order-brilliance/80");
          vpLabel.textContent = "VP/s";
        } else {
          vpLabel.classList.add("text-gray-300");
          vpLabel.textContent = "unclaimed";
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
  },
};

/**
 * Chest label type definition
 */
export const ChestLabelType: LabelTypeDefinition<ChestLabelData> = {
  type: "chest",
  defaultConfig: LABEL_TYPE_CONFIGS.CHEST,

  createElement: (data: ChestLabelData): HTMLElement => {
    // Create base label with chest styling
    const labelDiv = createLabelBase(false); // Chests don't have ownership

    // Override text color for chests
    labelDiv.style.setProperty("color", LABEL_STYLES.CHEST.textColor!, "important");
    labelDiv.style.setProperty("background-color", LABEL_STYLES.CHEST.backgroundColor!, "important");
    labelDiv.style.setProperty("border-color", LABEL_STYLES.CHEST.borderColor!, "important");

    // Add chest icon
    const img = document.createElement("img");
    img.src = "/images/labels/chest.png";
    img.classList.add("w-5", "h-5", "inline-block", "object-contain", "flex-shrink-0");
    img.setAttribute("data-component", "chest-icon");
    labelDiv.appendChild(img);

    // Create content container
    const contentContainer = createContentContainer();

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

  createElement: (data: QuestLabelData): HTMLElement => {
    // Create base label with quest styling
    const labelDiv = createLabelBase(false); // Quests don't have ownership

    // Override text color for quests (gold)
    labelDiv.style.setProperty("color", "#fbbf24", "important");
    labelDiv.style.setProperty("background-color", "rgba(251, 191, 36, 0.3)", "important");
    labelDiv.style.setProperty("border-color", "rgba(245, 158, 11, 0.5)", "important");

    // Add quest icon
    const img = document.createElement("img");
    img.src = "/images/labels/quest.png";
    img.classList.add("w-5", "h-5", "inline-block", "object-contain", "flex-shrink-0");
    img.setAttribute("data-component", "quest-icon");
    labelDiv.appendChild(img);

    // Create content container
    const contentContainer = createContentContainer();

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
    createElement: config.createElement || ((data) => document.createElement("div")),
    updateElement: config.updateElement,
    shouldDisplay: config.shouldDisplay,
  };
}

/**
 * Convenience functions for backward compatibility
 */
export const createArmyLabel = (army: ArmyLabelData): HTMLElement => {
  return ArmyLabelType.createElement(army);
};

export const updateArmyLabel = (labelElement: HTMLElement, army: ArmyLabelData): void => {
  ArmyLabelType.updateElement?.(labelElement, army);
};

export const createStructureLabel = (structure: StructureLabelData): HTMLElement => {
  return StructureLabelType.createElement(structure);
};

export const updateStructureLabel = (labelElement: HTMLElement, structure: StructureLabelData): void => {
  StructureLabelType.updateElement?.(labelElement, structure);
};

export const createChestLabel = (chest: ChestLabelData): HTMLElement => {
  return ChestLabelType.createElement(chest);
};

export const createQuestLabel = (quest: QuestLabelData): HTMLElement => {
  return QuestLabelType.createElement(quest);
};
