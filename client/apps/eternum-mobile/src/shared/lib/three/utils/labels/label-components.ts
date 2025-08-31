import { BuildingType, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";

/**
 * Component factory for creating reusable label UI elements
 */

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
 * Create content container with mobile-optimized styling
 */
export function createContentContainer(): {
  wrapper: HTMLElement;
  appendChild: (child: HTMLElement) => void;
} {
  const textContainer = document.createElement("div");
  textContainer.classList.add(
    "ml-1",
    "flex",
    "flex-col",
    "justify-center",
    "items-start",
    "text-left",
    "min-w-0",
    "gap-0.5",
    "leading-tight",
  );
  textContainer.setAttribute("data-component", "content-container");

  return {
    wrapper: textContainer,
    appendChild: (child: HTMLElement) => textContainer.appendChild(child),
  };
}

/**
 * Create owner display element
 */
export function createOwnerDisplayElement(options: {
  owner: { address: bigint; ownerName: string; guildName: string };
  isMine: boolean;
  color?: string;
  isDaydreamsAgent?: boolean;
}): HTMLElement {
  const { owner, isMine, isDaydreamsAgent } = options;

  const ownerDisplay = document.createElement("div");
  ownerDisplay.classList.add("flex", "items-center", "gap-0.5", "min-w-0", "absolute", "-top-5", "left-0");
  ownerDisplay.setAttribute("data-component", "owner");

  const ownerText = document.createElement("span");
  ownerText.classList.add("truncate", "text-xxs", "leading-none");
  ownerText.style.color = "inherit";

  if (owner.ownerName && owner.ownerName !== "test") {
    ownerText.textContent = cleanText(owner.ownerName);
  } else if (isDaydreamsAgent) {
    ownerText.textContent = "Agent";
  } else if (isMine) {
    ownerText.textContent = "My Army";
  } else {
    ownerText.textContent = "Army";
  }

  ownerDisplay.appendChild(ownerText);
  return ownerDisplay;
}

/**
 * Create troop count display
 */
export function createTroopCountDisplay(troopCount: number, troopType: TroopType, troopTier: TroopTier): HTMLElement {
  const troopDisplay = document.createElement("div");
  troopDisplay.classList.add("flex", "items-center", "text-xxs", "gap-0.5", "leading-none");
  troopDisplay.setAttribute("data-component", "troop-count");

  const troopIcon = document.createElement("span");
  troopIcon.textContent = "⚔️";
  troopIcon.classList.add("text-yellow-400");
  troopDisplay.appendChild(troopIcon);

  const troopText = document.createElement("span");
  troopText.classList.add("text-white", "font-mono", "text-xxs", "leading-none");
  troopText.setAttribute("data-role", "count");

  const troopName = getTroopDisplayName(troopType, troopTier);
  const troopCountText = troopCount ? `${troopCount}x ${troopName}` : troopName;
  troopText.textContent = troopCountText;
  troopDisplay.appendChild(troopText);

  return troopDisplay;
}

/**
 * Create stamina bar component
 */
export function createStaminaBar(currentStamina: number, maxStamina: number): HTMLElement {
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.gap = "4px";
  container.style.fontSize = "10px";
  container.setAttribute("data-component", "stamina-bar");

  const icon = document.createElement("span");
  icon.textContent = "⚡";
  icon.style.color = "#facc15";
  container.appendChild(icon);

  const progressBar = document.createElement("div");
  progressBar.style.position = "relative";
  progressBar.style.backgroundColor = "#374151";
  progressBar.style.borderRadius = "9999px";
  progressBar.style.height = "8px";
  progressBar.style.width = "80px";
  progressBar.style.minWidth = "80px";
  progressBar.style.maxWidth = "80px";
  progressBar.style.overflow = "hidden";
  progressBar.style.border = "1px solid rgba(255, 255, 255, 0.2)";
  progressBar.setAttribute("data-role", "progress-container");

  const progressFill = document.createElement("div");
  progressFill.style.position = "absolute";
  progressFill.style.top = "0";
  progressFill.style.left = "0";
  progressFill.style.height = "100%";
  progressFill.style.borderRadius = "9999px";
  progressFill.style.transition = "width 0.3s ease-in-out";
  progressFill.setAttribute("data-role", "progress-fill");

  const percentage = Math.max(0, Math.min(100, (currentStamina / maxStamina) * 100));
  progressFill.style.width = `${percentage}%`;

  if (percentage > 66) {
    progressFill.style.backgroundColor = "#10b981";
  } else if (percentage > 33) {
    progressFill.style.backgroundColor = "#f59e0b";
  } else {
    progressFill.style.backgroundColor = "#ef4444";
  }

  progressBar.appendChild(progressFill);
  container.appendChild(progressBar);

  const text = document.createElement("span");
  text.textContent = `${currentStamina}/${maxStamina}`;
  text.style.color = "#ffffff";
  text.style.fontFamily = "monospace";
  text.style.fontSize = "10px";
  text.style.fontWeight = "500";
  text.setAttribute("data-role", "stamina-text");
  container.appendChild(text);

  return container;
}

/**
 * Update stamina bar values
 */
export function updateStaminaBar(staminaBar: HTMLElement, currentStamina: number, maxStamina: number): void {
  const progressFill = staminaBar.querySelector("[data-role='progress-fill']") as HTMLElement;
  const textElement = staminaBar.querySelector("[data-role='stamina-text']") as HTMLElement;

  if (textElement) {
    textElement.textContent = `${currentStamina}/${maxStamina}`;
  }

  if (progressFill) {
    const percentage = Math.max(0, Math.min(100, (currentStamina / maxStamina) * 100));
    progressFill.style.width = `${percentage}%`;

    if (percentage > 66) {
      progressFill.style.backgroundColor = "#10b981";
    } else if (percentage > 33) {
      progressFill.style.backgroundColor = "#f59e0b";
    } else {
      progressFill.style.backgroundColor = "#ef4444";
    }
  }
}

/**
 * Create guard army display for structures
 */
export function createGuardArmyDisplay(
  guardArmies: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>,
): HTMLElement {
  const container = document.createElement("div");
  container.classList.add(
    "flex",
    "flex-row",
    "gap-0.5",
    "text-xxs",
    "overflow-x-auto",
    "text-gray-400",
    "leading-none",
  );
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
      guardDiv.classList.add("flex", "items-center", "gap-0.5", "rounded", "px-1", "py-0.5", "bg-black/40");

      const resourceId = getTroopResourceIdFromCategory(guard.category);
      if (resourceId) {
        const iconContainer = document.createElement("div");
        iconContainer.classList.add("w-3", "h-3", "flex-shrink-0");

        const img = document.createElement("img");
        img.src = `/images/resources/${resourceId}.png`;
        img.classList.add("w-full", "h-full", "object-contain");
        iconContainer.appendChild(img);
        guardDiv.appendChild(iconContainer);
      }

      const countSpan = document.createElement("span");
      countSpan.textContent = guard.count.toString();
      countSpan.classList.add("font-semibold", "text-xxs", "leading-none");
      guardDiv.appendChild(countSpan);

      const tierBadge = document.createElement("span");
      tierBadge.textContent = `T${guard.tier}`;
      tierBadge.classList.add(
        "px-0.5",
        "py-0",
        "rounded",
        "text-[9px]",
        "font-bold",
        "border",
        "leading-none",
        ...getTierStyle(guard.tier).split(" "),
      );
      guardDiv.appendChild(tierBadge);

      container.appendChild(guardDiv);
    }
  });

  return container;
}

/**
 * Create production display for structures
 */
export function createProductionDisplay(
  activeProductions: Array<{ buildingCount: number; buildingType: BuildingType }>,
): HTMLElement {
  const container = document.createElement("div");
  container.classList.add("flex", "flex-wrap", "items-center", "gap-1", "text-xxs", "leading-none");
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
    productionDiv.classList.add("flex", "items-center", "gap-0.5", "bg-black/40", "rounded", "px-1", "py-0.5");

    const resourceName = BuildingTypeToIcon[production.buildingType];
    if (resourceName) {
      const iconContainer = document.createElement("div");
      iconContainer.classList.add("w-3", "h-3", "flex-shrink-0");

      const img = document.createElement("img");

      if (resourceName === "House") {
        img.src = "/images/buildings/thumb/house.png";
      } else if (resourceName === "Silo") {
        img.src = "/images/buildings/thumb/silo.png";
      } else {
        const resourceId = ResourcesIds[resourceName as keyof typeof ResourcesIds];
        if (resourceId) {
          img.src = `/images/resources/${resourceId}.png`;
        }
      }

      img.classList.add("w-full", "h-full", "object-contain");
      iconContainer.appendChild(img);
      productionDiv.appendChild(iconContainer);
    }

    const countSpan = document.createElement("span");
    countSpan.textContent = `${production.buildingCount}`;
    countSpan.classList.add("text-white", "font-semibold", "text-xxs", "leading-none");
    productionDiv.appendChild(countSpan);

    container.appendChild(productionDiv);
  });

  return container;
}

/**
 * Get display name for troop type and tier
 */
export function getTroopDisplayName(troopType: TroopType, troopTier: TroopTier): string {
  const typeNames: Record<TroopType, string> = {
    [TroopType.Paladin]: "Paladin",
    [TroopType.Crossbowman]: "Crossbowman",
    [TroopType.Knight]: "Knight",
  };

  const tierNames: Record<TroopTier, string> = {
    [TroopTier.T1]: "I",
    [TroopTier.T2]: "II",
    [TroopTier.T3]: "III",
  };

  return `${typeNames[troopType] || "Unknown"} ${tierNames[troopTier] || ""}`;
}
