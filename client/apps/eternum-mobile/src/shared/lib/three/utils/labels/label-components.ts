import { BuildingType, TroopTier, TroopType } from "@bibliothecadao/types";

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
 * Create content container with mobile-optimized styling
 */
export function createContentContainer(): {
  wrapper: HTMLElement;
  appendChild: (child: HTMLElement) => void;
} {
  const textContainer = document.createElement("div");
  textContainer.classList.add("ml-1", "flex", "flex-col", "justify-center", "items-start", "text-left", "min-w-0");
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
  ownerDisplay.classList.add("flex", "items-center", "gap-1", "min-w-0");
  ownerDisplay.setAttribute("data-component", "owner");

  const ownerText = document.createElement("span");
  ownerText.classList.add("truncate", "text-xxs");
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
  troopDisplay.classList.add("flex", "items-center", "text-xxs", "gap-1");
  troopDisplay.setAttribute("data-component", "troop-count");

  const troopIcon = document.createElement("span");
  troopIcon.textContent = "⚔️";
  troopIcon.classList.add("text-yellow-400");
  troopDisplay.appendChild(troopIcon);

  const troopText = document.createElement("span");
  troopText.classList.add("text-white", "font-mono");
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
  const staminaContainer = document.createElement("div");
  staminaContainer.classList.add("flex", "items-center", "text-xxs", "gap-1");
  staminaContainer.setAttribute("data-component", "stamina-bar");

  const staminaIcon = document.createElement("span");
  staminaIcon.textContent = "⚡";
  staminaIcon.classList.add("text-yellow-400");
  staminaContainer.appendChild(staminaIcon);

  const staminaText = document.createElement("span");
  staminaText.textContent = `${currentStamina}/${maxStamina}`;
  staminaText.classList.add("text-white", "font-mono");
  staminaContainer.appendChild(staminaText);

  return staminaContainer;
}

/**
 * Update stamina bar values
 */
export function updateStaminaBar(staminaBar: HTMLElement, currentStamina: number, maxStamina: number): void {
  const staminaText = staminaBar.querySelector("span:last-child");
  if (staminaText) {
    staminaText.textContent = `${currentStamina}/${maxStamina}`;
  }
}

/**
 * Create guard army display for structures
 */
export function createGuardArmyDisplay(
  guardArmies: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>,
): HTMLElement {
  const guardContainer = document.createElement("div");
  guardContainer.classList.add("flex", "flex-col", "gap-0.5", "mt-1");
  guardContainer.setAttribute("data-component", "guard-armies");

  guardArmies.forEach((guard) => {
    if (guard.count > 0) {
      const guardRow = document.createElement("div");
      guardRow.classList.add("flex", "items-center", "gap-1", "text-xxs");

      const guardIcon = document.createElement("span");
      guardIcon.textContent = "🛡️";
      guardIcon.classList.add("text-blue-400");
      guardRow.appendChild(guardIcon);

      const guardText = document.createElement("span");
      guardText.classList.add("text-white", "font-mono");
      guardText.textContent = `${guard.count}x T${guard.tier}`;
      guardRow.appendChild(guardText);

      guardContainer.appendChild(guardRow);
    }
  });

  return guardContainer;
}

/**
 * Create production display for structures
 */
export function createProductionDisplay(
  activeProductions: Array<{ buildingCount: number; buildingType: BuildingType }>,
): HTMLElement {
  const productionContainer = document.createElement("div");
  productionContainer.classList.add("flex", "flex-col", "gap-0.5", "mt-1");
  productionContainer.setAttribute("data-component", "productions");

  activeProductions.forEach((production) => {
    const productionRow = document.createElement("div");
    productionRow.classList.add("flex", "items-center", "gap-1", "text-xxs");

    const productionIcon = document.createElement("span");
    productionIcon.textContent = "🏭";
    productionIcon.classList.add("text-orange-400");
    productionRow.appendChild(productionIcon);

    const productionText = document.createElement("span");
    productionText.classList.add("text-white", "font-mono");
    productionText.textContent = `${production.buildingCount}x ${getBuildingDisplayName(production.buildingType)}`;
    productionRow.appendChild(productionText);

    productionContainer.appendChild(productionRow);
  });

  return productionContainer;
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

/**
 * Get display name for building type
 */
function getBuildingDisplayName(buildingType: BuildingType): string {
  // This would need to be implemented based on your BuildingType enum
  return `Building ${buildingType}`;
}
