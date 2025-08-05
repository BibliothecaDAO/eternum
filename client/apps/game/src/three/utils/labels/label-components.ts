import { COLORS } from "@/ui/features/settlement";
import { BuildingType, ResourcesIds, TroopTier } from "@bibliothecadao/types";
import { CameraView } from "../../scenes/hexagon-scene";

/**
 * Component factory for creating reusable label UI elements
 */

/**
 * Clean text by removing null characters and trimming whitespace
 */
export const cleanText = (text?: string): string => {
  if (!text) return "";
  return text
    .toString()
    .split("")
    .filter((char) => char.charCodeAt(0) !== 0)
    .join("")
    .trim();
};

/**
 * Guild color configuration
 */
const GUILD_COLOR_SETS = [
  ["from-emerald-600/60", "to-emerald-800/60", "border-emerald-500/30"],
  ["from-amber-600/60", "to-amber-800/60", "border-amber-500/30"],
  ["from-violet-600/60", "to-violet-800/60", "border-violet-500/30"],
  ["from-cyan-600/60", "to-cyan-800/60", "border-cyan-500/30"],
  ["from-rose-600/60", "to-rose-800/60", "border-rose-500/30"],
  ["from-blue-600/60", "to-blue-800/60", "border-blue-500/30"],
  ["from-orange-600/60", "to-red-700/60", "border-orange-500/30"],
];

/**
 * Get guild color set based on guild name
 */
export const getGuildColorSet = (guildName: string) => {
  const cleanedName = cleanText(guildName);
  const firstChar = cleanedName.length > 0 ? cleanedName.charAt(0).toLowerCase() : "a";
  const charCode = firstChar.charCodeAt(0);

  let index = Math.floor((charCode - 97) / 4);
  if (index < 0 || index >= GUILD_COLOR_SETS.length) {
    index = GUILD_COLOR_SETS.length - 1;
  }

  return {
    colorSet: GUILD_COLOR_SETS[index],
    cleanedName,
    firstChar,
  };
};

/**
 * Tier style configuration
 */
export const getTierStyle = (tier: number): string => {
  switch (tier) {
    case 1:
      return "bg-gradient-to-b from-blue-500/30 to-blue-500/10 border-blue-400/40 text-blue-300 shadow-blue-500/10";
    case 2:
      return "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 border-emerald-400/40 text-emerald-300 shadow-emerald-500/10";
    case 3:
      return "!bg-purple-600 !text-white !border-purple-400 animate-pulse";
    default:
      return "bg-gradient-to-b from-gold/30 to-gold/10 border-gold/40 text-gold shadow-gold/10";
  }
};

/**
 * Troop tier to stars mapping
 */
export const TIERS_TO_STARS: Record<TroopTier, string> = {
  [TroopTier.T1]: "⭐",
  [TroopTier.T2]: "⭐⭐",
  [TroopTier.T3]: "⭐⭐⭐",
};

/**
 * Building type to resource icon mapping
 */
export const BuildingTypeToIcon: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceWood]: "Wood",
  [BuildingType.ResourceStone]: "Stone",
  [BuildingType.ResourceCoal]: "Coal",
  [BuildingType.ResourceCopper]: "Copper",
  [BuildingType.ResourceObsidian]: "Obsidian",
  [BuildingType.ResourceSilver]: "Silver",
  [BuildingType.ResourceIronwood]: "Ironwood",
  [BuildingType.ResourceColdIron]: "ColdIron",
  [BuildingType.ResourceGold]: "Gold",
  [BuildingType.ResourceHartwood]: "Hartwood",
  [BuildingType.ResourceDiamonds]: "Diamonds",
  [BuildingType.ResourceSapphire]: "Sapphire",
  [BuildingType.ResourceRuby]: "Ruby",
  [BuildingType.ResourceDeepCrystal]: "DeepCrystal",
  [BuildingType.ResourceIgnium]: "Ignium",
  [BuildingType.ResourceEtherealSilica]: "EtherealSilica",
  [BuildingType.ResourceTrueIce]: "TrueIce",
  [BuildingType.ResourceTwilightQuartz]: "TwilightQuartz",
  [BuildingType.ResourceAlchemicalSilver]: "AlchemicalSilver",
  [BuildingType.ResourceAdamantine]: "Adamantine",
  [BuildingType.ResourceMithral]: "Mithral",
  [BuildingType.ResourceDragonhide]: "Dragonhide",
  [BuildingType.WorkersHut]: "House",
  [BuildingType.Storehouse]: "Silo",
  [BuildingType.ResourceWheat]: "Wheat",
  [BuildingType.ResourceFish]: "Fish",
  [BuildingType.ResourceDonkey]: "Donkey",
  [BuildingType.ResourceLabor]: "Labor",
  [BuildingType.ResourceCrossbowmanT1]: "Crossbowman",
  [BuildingType.ResourceCrossbowmanT2]: "Crossbowman",
  [BuildingType.ResourceCrossbowmanT3]: "Crossbowman",
  [BuildingType.ResourcePaladinT1]: "Paladin",
  [BuildingType.ResourcePaladinT2]: "Paladin",
  [BuildingType.ResourcePaladinT3]: "Paladin",
  [BuildingType.ResourceKnightT1]: "Knight",
  [BuildingType.ResourceKnightT2]: "Knight",
  [BuildingType.ResourceKnightT3]: "Knight",
  [BuildingType.ResourceEssence]: "Essence",
};

/**
 * Get troop resource ID from category name
 */
export const getTroopResourceIdFromCategory = (category: string | null): number | null => {
  if (!category) return null;

  switch (category.toLowerCase()) {
    case "knight":
      return ResourcesIds.Knight;
    case "crossbowman":
      return ResourcesIds.Crossbowman;
    case "paladin":
      return ResourcesIds.Paladin;
    default:
      return null;
  }
};

/**
 * Component creation functions
 */

/**
 * Create owner display element (name + guild badge)
 */
export interface OwnerDisplayOptions {
  owner: {
    address: bigint;
    ownerName?: string;
    guildName?: string;
  };
  isMine: boolean;
  isAlly?: boolean;
  cameraView: CameraView;
  color?: string;
  isDaydreamsAgent?: boolean;
}

export const createOwnerDisplayElement = (options: OwnerDisplayOptions): HTMLElement => {
  const { owner, isMine, isAlly, color, isDaydreamsAgent } = options;

  const container = document.createElement("div");
  container.classList.add("flex", "items-center", "truncate", "gap-1");

  // Create name element
  const displayName = owner.ownerName || "";
  const nameSpan = document.createElement("span");
  nameSpan.textContent = displayName;
  nameSpan.classList.add("font-medium");

  // Determine text color
  let finalTextColor: string;
  if (isDaydreamsAgent) {
    finalTextColor = COLORS.SELECTED;
  } else if (color) {
    finalTextColor = color;
  } else {
    // Import from label-config to avoid circular dependency
    if (isMine === true) {
      finalTextColor = "#d9f99d"; // MINE text color
    } else if (isAlly === true) {
      finalTextColor = "#bae6fd"; // ALLY text color
    } else {
      finalTextColor = "#fecdd3"; // ENEMY text color
    }
  }

  nameSpan.style.setProperty("color", finalTextColor, "important");
  container.appendChild(nameSpan);

  // Add guild badge if available
  if (owner.guildName) {
    const { colorSet, cleanedName } = getGuildColorSet(owner.guildName);
    const [fromColor, toColor, borderColor] = colorSet;

    const guildBadge = document.createElement("span");
    guildBadge.textContent = `⚔️ ${cleanedName || "Guild"}`;
    guildBadge.classList.add(
      "text-xxs",
      "bg-gradient-to-r",
      fromColor,
      toColor,
      "px-1.5",
      "py-0.5",
      "rounded-sm",
      "ml-1.5",
      "inline-block",
      "border",
      borderColor,
      "font-semibold",
      "shadow-sm",
      "text-white",
    );

    container.appendChild(guildBadge);
  }

  return container;
};

/**
 * Create stamina bar component
 */
export const createStaminaBar = (currentStamina: number, maxStamina: number): HTMLElement => {
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.gap = "4px";
  container.style.fontSize = "10px";
  container.setAttribute("data-component", "stamina-bar");

  // Stamina icon
  const icon = document.createElement("span");
  icon.textContent = "⚡";
  icon.style.color = "#facc15"; // yellow-400
  container.appendChild(icon);

  // Progress bar container
  const progressBar = document.createElement("div");
  progressBar.style.position = "relative";
  progressBar.style.backgroundColor = "#374151"; // gray-700
  progressBar.style.borderRadius = "9999px";
  progressBar.style.height = "8px";
  progressBar.style.width = "64px";
  progressBar.style.overflow = "hidden";
  progressBar.style.border = "1px solid rgba(255, 255, 255, 0.2)";

  const progressFill = document.createElement("div");
  progressFill.style.position = "absolute";
  progressFill.style.top = "0";
  progressFill.style.left = "0";
  progressFill.style.height = "100%";
  progressFill.style.borderRadius = "9999px";
  progressFill.style.transition = "width 0.3s ease-in-out";

  const percentage = Math.max(0, Math.min(100, (currentStamina / maxStamina) * 100));
  progressFill.style.width = `${percentage}%`;

  // Color based on stamina level
  if (percentage > 66) {
    progressFill.style.backgroundColor = "#10b981"; // green-500
  } else if (percentage > 33) {
    progressFill.style.backgroundColor = "#f59e0b"; // amber-500
  } else {
    progressFill.style.backgroundColor = "#ef4444"; // red-500
  }

  progressBar.appendChild(progressFill);
  container.appendChild(progressBar);

  // Text display
  const text = document.createElement("span");
  text.textContent = `${currentStamina}/${maxStamina}`;
  text.style.color = "#ffffff";
  text.style.fontFamily = "monospace";
  text.style.fontSize = "10px";
  text.style.fontWeight = "500";
  container.appendChild(text);

  return container;
};

/**
 * Create troop count display
 */
export const createTroopCountDisplay = (count: number, troopType: string, tier: string): HTMLElement => {
  const container = document.createElement("div");
  container.classList.add("flex", "items-center", "gap-2", "rounded", "px-1.5", "py-0.5", "bg-black/40", "text-xxs");
  container.setAttribute("data-component", "troop-count");

  // Sword icon (like shield for guards)
  const swordIcon = document.createElement("span");
  swordIcon.textContent = "⚔️";
  container.appendChild(swordIcon);

  // Troop resource icon
  const resourceId = getTroopResourceIdFromCategory(troopType);
  if (resourceId) {
    const iconContainer = document.createElement("div");
    iconContainer.classList.add("w-6", "h-6", "flex-shrink-0");

    const img = document.createElement("img");
    img.src = `/images/resources/${resourceId}.png`;
    img.classList.add("w-full", "h-full", "object-contain");
    iconContainer.appendChild(img);
    container.appendChild(iconContainer);
  }

  // Count
  const countSpan = document.createElement("span");
  countSpan.textContent = count.toString();
  countSpan.classList.add("font-semibold", "min-w-[1rem]", "text-center", "text-white");
  countSpan.setAttribute("data-role", "count");
  container.appendChild(countSpan);

  // Tier badge
  const tierNumber = parseInt(tier.replace("T", "")) || 1;
  const tierBadge = document.createElement("span");
  tierBadge.textContent = `T${tierNumber}`;
  tierBadge.classList.add(
    "px-1",
    "py-0.5",
    "rounded",
    "text-[10px]",
    "font-bold",
    "border",
    ...getTierStyle(tierNumber).split(" "),
  );
  container.appendChild(tierBadge);

  return container;
};

/**
 * Create guard army display
 */
export const createGuardArmyDisplay = (
  guardArmies: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>,
): HTMLElement => {
  const container = document.createElement("div");
  container.classList.add("flex", "flex-row", "gap-1", "text-xxs", "overflow-x-auto", "text-gray-400");
  container.setAttribute("data-component", "guard-armies");

  if (guardArmies.length === 0) {
    const noGuards = document.createElement("span");
    noGuards.textContent = "No Guards";
    noGuards.classList.add("italic");
    container.appendChild(noGuards);
    return container;
  }

  guardArmies.forEach((guard) => {
    if (guard.count > 0) {
      const guardDiv = document.createElement("div");
      guardDiv.classList.add("flex", "items-center", "gap-2", "rounded", "px-1.5", "py-0.5", "bg-black/40");

      // Shield icon
      const shieldIcon = document.createElement("span");
      shieldIcon.textContent = "🛡️";
      guardDiv.appendChild(shieldIcon);

      // Troop resource icon
      const resourceId = getTroopResourceIdFromCategory(guard.category);
      if (resourceId) {
        const iconContainer = document.createElement("div");
        iconContainer.classList.add("w-4", "h-4", "flex-shrink-0");

        const img = document.createElement("img");
        img.src = `/images/resources/${resourceId}.png`;
        img.classList.add("w-full", "h-full", "object-contain");
        iconContainer.appendChild(img);
        guardDiv.appendChild(iconContainer);
      }

      // Count
      const countSpan = document.createElement("span");
      countSpan.textContent = guard.count.toString();
      countSpan.classList.add("font-semibold", "min-w-[1rem]", "text-center");
      guardDiv.appendChild(countSpan);

      // Tier badge
      const tierBadge = document.createElement("span");
      tierBadge.textContent = `T${guard.tier}`;
      tierBadge.classList.add(
        "px-1",
        "py-0.5",
        "rounded",
        "text-[10px]",
        "font-bold",
        "border",
        ...getTierStyle(guard.tier).split(" "),
      );
      guardDiv.appendChild(tierBadge);

      container.appendChild(guardDiv);
    }
  });

  return container;
};

/**
 * Create production display
 */
export const createProductionDisplay = (
  activeProductions: Array<{ buildingCount: number; buildingType: BuildingType }>,
): HTMLElement => {
  const container = document.createElement("div");
  container.classList.add("flex", "flex-wrap", "items-center", "gap-2", "text-xxs");
  container.setAttribute("data-component", "productions");

  if (activeProductions.length === 0) {
    const noProduction = document.createElement("span");
    noProduction.textContent = "No Active Production";
    noProduction.classList.add("text-gray-400", "italic");
    container.appendChild(noProduction);
    return container;
  }

  activeProductions.forEach((production) => {
    const productionDiv = document.createElement("div");
    productionDiv.classList.add("flex", "items-center", "gap-1", "bg-black/40", "rounded", "px-1.5", "py-0.5");

    // Create resource icon based on building type
    const resourceName = BuildingTypeToIcon[production.buildingType];
    if (resourceName) {
      const iconContainer = document.createElement("div");
      iconContainer.classList.add("w-8", "h-8", "flex-shrink-0");

      const img = document.createElement("img");

      // Special handling for buildings that use different images
      if (resourceName === "House") {
        img.src = "/images/buildings/thumb/house.png";
      } else if (resourceName === "Silo") {
        img.src = "/images/buildings/thumb/silo.png";
      } else {
        // Use ResourcesIds enum to get the correct ID
        const resourceId = ResourcesIds[resourceName as keyof typeof ResourcesIds];
        if (resourceId) {
          img.src = `/images/resources/${resourceId}.png`;
        }
      }

      img.classList.add("w-full", "h-full", "object-contain");
      iconContainer.appendChild(img);
      productionDiv.appendChild(iconContainer);
    }

    // Production count
    const countSpan = document.createElement("span");
    countSpan.textContent = `${production.buildingCount}`;
    countSpan.classList.add("text-white", "font-semibold");
    productionDiv.appendChild(countSpan);

    container.appendChild(productionDiv);
  });

  return container;
};

/**
 * Create content container with transition wrapper
 */
export const createContentContainer = (cameraView: CameraView): HTMLElement & { wrapper: HTMLElement } => {
  // Create wrapper for width transition
  const wrapperContainer = document.createElement("div");
  wrapperContainer.classList.add("transition-all", "duration-700", "ease-in-out", "overflow-hidden");

  // Create inner container for content
  const contentContainer = document.createElement("div");
  contentContainer.classList.add("flex", "flex-col", "w-max");

  // Add empty div with w-2 for spacing
  const spacerDiv = document.createElement("div");
  spacerDiv.classList.add("w-2");
  contentContainer.appendChild(spacerDiv);

  // Generate a unique ID for this container
  const containerId = `container_${Math.random().toString(36).substring(2, 9)}`;
  wrapperContainer.dataset.containerId = containerId;

  // Put content inside wrapper
  wrapperContainer.appendChild(contentContainer);

  // Initial state based on camera view
  const expandedClasses = ["max-w-[1000px]", "ml-2", "opacity-100"];
  const collapsedClasses = ["max-w-0", "ml-0", "opacity-0"];

  if (cameraView === CameraView.Far) {
    wrapperContainer.classList.add(...collapsedClasses);
  } else {
    wrapperContainer.classList.add(...expandedClasses);
  }

  // Return contentContainer with wrapper reference
  const result = contentContainer as unknown as HTMLElement & { wrapper: HTMLElement };
  result.wrapper = wrapperContainer;
  return result;
};

/**
 * Update an existing stamina bar with new values
 */
export const updateStaminaBar = (staminaBarElement: HTMLElement, currentStamina: number, maxStamina: number): void => {
  const progressFill = staminaBarElement.querySelector("div > div") as HTMLElement;
  const textElement = staminaBarElement.querySelector("span:last-child") as HTMLElement;

  if (textElement) {
    textElement.textContent = `${currentStamina}/${maxStamina}`;
  }

  if (progressFill) {
    const percentage = Math.max(0, Math.min(100, (currentStamina / maxStamina) * 100));
    progressFill.style.width = `${percentage}%`;

    // Color based on stamina level
    if (percentage > 66) {
      progressFill.style.backgroundColor = "#10b981"; // green-500
    } else if (percentage > 33) {
      progressFill.style.backgroundColor = "#f59e0b"; // amber-500
    } else {
      progressFill.style.backgroundColor = "#ef4444"; // red-500
    }
  }
};
