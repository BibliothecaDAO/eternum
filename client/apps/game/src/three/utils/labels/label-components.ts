import { BuildingType, ResourcesIds, TroopTier } from "@bibliothecadao/types";
import { CameraView } from "../../scenes/hexagon-scene";
import { resolveCameraView } from "./label-view";

/**
 * Component factory for creating reusable label UI elements
 */

const SOFT_LABEL_COLOR = "#f6f1e5";

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
      return "!bg-purple-600 !text-[#f6f1e5] !border-purple-400 animate-pulse";
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

export const formatCompactNumber = (value?: number | null): string => {
  if (value === undefined || value === null) {
    return "";
  }

  const absValue = Math.abs(value);

  if (absValue >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(absValue >= 10_000_000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, "")}M`;
  }

  if (absValue >= 1_000) {
    const formatted = (value / 1_000).toFixed(absValue >= 10_000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, "")}k`;
  }

  return value.toString();
};

const formatStaminaPercent = (current: number, max: number): string => {
  if (!max || max <= 0) {
    return "0%";
  }

  const pct = Math.round((current / max) * 100);
  return `${pct}%`;
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

  const lowered = cleanText(category).toLowerCase();

  if (lowered.includes("knight")) {
    return ResourcesIds.Knight;
  }

  if (lowered.includes("crossbowman")) {
    return ResourcesIds.Crossbowman;
  }

  if (lowered.includes("paladin")) {
    return ResourcesIds.Paladin;
  }

  return null;
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
  const { owner, isMine, isAlly, color, isDaydreamsAgent, cameraView: inputView } = options;
  const cameraView = resolveCameraView(inputView);

  const container = document.createElement("div");
  container.classList.add("flex", "items-center", "truncate", "gap-1");
  if (cameraView === CameraView.Medium) {
    container.classList.add("gap-0.5", "text-[11px]");
  }
  container.setAttribute("data-component", "owner");

  // Create name element
  const displayName = cleanText(owner.ownerName);
  const nameSpan = document.createElement("span");
  if (cameraView === CameraView.Medium && displayName.length > 14) {
    nameSpan.textContent = `${displayName.slice(0, 12)}…`;
    nameSpan.title = displayName;
  } else {
    nameSpan.textContent = displayName;
  }
  nameSpan.classList.add("font-medium");

  // Determine text color
  let finalTextColor: string;
  if (isDaydreamsAgent) {
    finalTextColor = "#FFF5EA";
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
export const createStaminaBar = (currentStamina: number, maxStamina: number, inputView: CameraView): HTMLElement => {
  const cameraView = resolveCameraView(inputView);
  const container = document.createElement("div");
  container.setAttribute("data-component", "stamina-bar");

  if (cameraView === CameraView.Medium) {
    container.classList.add("flex", "items-center", "gap-1", "text-[11px]");

    const icon = document.createElement("span");
    icon.textContent = "⚡";
    icon.classList.add("text-yellow-400");
    container.appendChild(icon);

    const percent = document.createElement("span");
    percent.textContent = formatStaminaPercent(currentStamina, maxStamina);
    percent.classList.add("font-semibold", "tracking-tight");
    percent.style.color = SOFT_LABEL_COLOR;
    percent.setAttribute("data-role", "stamina-percent");
    container.appendChild(percent);

    return container;
  }

  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.gap = "4px";
  container.style.fontSize = "10px";

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
};

/**
 * Create troop count display
 */
export const createTroopCountDisplay = (
  count: number,
  troopType: string,
  tier: TroopTier | string | number,
  inputView: CameraView,
): HTMLElement => {
  const cameraView = resolveCameraView(inputView);
  const container = document.createElement("div");
  container.setAttribute("data-component", "troop-count");
  container.classList.add("flex", "items-center", "rounded", "bg-black/40", "text-xxs", "w-fit");

  if (cameraView === CameraView.Medium) {
    container.classList.add("gap-1", "px-1", "py-0.5");
  } else {
    container.classList.add("gap-1", "px-1.5", "py-0.5");
  }

  const swordIcon = document.createElement("span");
  swordIcon.textContent = "⚔️";
  if (cameraView === CameraView.Medium) {
    swordIcon.classList.add("text-[11px]");
  }
  container.appendChild(swordIcon);

  const resourceId = getTroopResourceIdFromCategory(troopType);
  if (resourceId && cameraView !== CameraView.Medium) {
    const iconContainer = document.createElement("div");
    iconContainer.classList.add("w-6", "h-6", "flex-shrink-0", "flex", "items-center", "justify-center");

    const img = document.createElement("img");
    img.src = `/images/resources/${resourceId}.png`;
    img.classList.add("w-full", "h-full", "object-contain");
    iconContainer.appendChild(img);
    container.appendChild(iconContainer);
  }

  const countSpan = document.createElement("span");
  const tierValue = typeof tier === "string" ? parseInt(tier.replace("T", ""), 10) || 1 : tier;
  countSpan.textContent = cameraView === CameraView.Medium ? formatCompactNumber(count) : count.toString();
  countSpan.classList.add("font-semibold", "min-w-[1rem]", "text-center");
  countSpan.style.color = SOFT_LABEL_COLOR;
  if (cameraView === CameraView.Medium) {
    countSpan.classList.add("text-[11px]", "min-w-0");
  } else {
    countSpan.classList.add("text-white");
  }
  countSpan.setAttribute("data-role", "count");
  container.appendChild(countSpan);

  const tierBadge = document.createElement("span");
  tierBadge.textContent = `T${tierValue}`;
  tierBadge.classList.add("px-1", "py-0.5", "rounded", "text-[10px]", "font-bold", "border");
  tierBadge.classList.add(...getTierStyle(tierValue).split(" "));
  if (cameraView === CameraView.Medium) {
    tierBadge.classList.add("leading-none");
  }
  container.appendChild(tierBadge);

  return container;
};

/**
 * Create guard army display
 */
export const createGuardArmyDisplay = (
  guardArmies:
    | Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>
    | undefined,
  inputView: CameraView,
): HTMLElement => {
  const cameraView = resolveCameraView(inputView);
  const container = document.createElement("div");
  container.setAttribute("data-component", "guard-armies");

  if (cameraView === CameraView.Medium) {
    container.classList.add("flex", "flex-row", "flex-wrap", "gap-1", "text-[11px]");
    container.style.color = SOFT_LABEL_COLOR;
  } else {
    container.classList.add("flex", "flex-row", "gap-1", "text-xxs", "overflow-x-auto");
    container.style.color = SOFT_LABEL_COLOR;
  }

  if (!guardArmies || guardArmies.length === 0) {
    const noGuards = document.createElement("span");
    noGuards.textContent = "No Guards";
    noGuards.classList.add("italic");
    container.appendChild(noGuards);
    return container;
  }

  if (cameraView === CameraView.Medium) {
    guardArmies.forEach((guard) => {
      if (guard.count <= 0) {
        return;
      }

      const troopDisplay = createTroopCountDisplay(guard.count, guard.category ?? "", guard.tier, cameraView);
      container.appendChild(troopDisplay);
    });

    return container;
  }

  const totalCount = guardArmies.reduce((total, guard) => total + (guard.count ?? 0), 0);

  if (totalCount > 0) {
    const totalContainer = document.createElement("div");
    totalContainer.classList.add(
      "flex",
      "items-center",
      "gap-2",
      "rounded",
      "px-2",
      "py-1",
      "bg-black/60",
      "border",
      "border-gold/30",
    );
    totalContainer.setAttribute("data-role", "total-guards");

    const totalIcon = document.createElement("span");
    totalIcon.textContent = "Σ";
    totalIcon.classList.add("text-gold", "font-semibold");
    totalContainer.appendChild(totalIcon);

    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total";
    totalLabel.classList.add("uppercase", "tracking-wide", "text-[10px]", "text-gold/70", "font-semibold");
    totalContainer.appendChild(totalLabel);

    const totalValue = document.createElement("span");
    totalValue.textContent = totalCount.toLocaleString();
    totalValue.classList.add("font-bold", "text-gold");
    totalValue.setAttribute("data-role", "count");
    totalContainer.appendChild(totalValue);

    container.appendChild(totalContainer);
  }

  guardArmies.forEach((guard) => {
    if (guard.count <= 0) {
      return;
    }

    const guardDiv = document.createElement("div");
    guardDiv.classList.add("flex", "items-center", "gap-1", "rounded", "px-1.5", "py-0.5", "bg-black/40");

    const shieldIcon = document.createElement("span");
    shieldIcon.textContent = "🛡️";
    guardDiv.appendChild(shieldIcon);

    const resourceId = getTroopResourceIdFromCategory(guard.category);
    if (resourceId) {
      const iconContainer = document.createElement("div");
      iconContainer.classList.add("w-6", "h-6", "flex-shrink-0", "flex", "items-center", "justify-center");

      const img = document.createElement("img");
      img.src = `/images/resources/${resourceId}.png`;
      img.classList.add("w-full", "h-full", "object-contain");
      iconContainer.appendChild(img);
      guardDiv.appendChild(iconContainer);
    }

    const countSpan = document.createElement("span");
    countSpan.textContent = guard.count.toString();
    countSpan.classList.add("font-semibold", "min-w-[1rem]", "text-center");
    countSpan.style.color = SOFT_LABEL_COLOR;
    guardDiv.appendChild(countSpan);

    const tierBadge = document.createElement("span");
    tierBadge.textContent = `T${guard.tier}`;
    tierBadge.classList.add("px-1", "py-0.5", "rounded", "text-[10px]", "font-bold", "border");
    tierBadge.classList.add(...getTierStyle(guard.tier).split(" "));
    guardDiv.appendChild(tierBadge);

    container.appendChild(guardDiv);
  });

  return container;
};

/**
 * Create production display
 */
export const createProductionDisplay = (
  activeProductions: Array<{ buildingCount: number; buildingType: BuildingType }> | undefined,
  inputView: CameraView,
): HTMLElement => {
  const cameraView = resolveCameraView(inputView);
  const container = document.createElement("div");
  container.setAttribute("data-component", "productions");

  if (cameraView === CameraView.Medium) {
    container.classList.add("flex", "flex-wrap", "items-center", "gap-1", "text-[11px]");
    container.style.color = SOFT_LABEL_COLOR;
  } else {
    container.classList.add("flex", "flex-wrap", "items-center", "gap-1", "text-xxs");
  }

  if (!activeProductions || activeProductions.length === 0) {
    const noProduction = document.createElement("span");
    noProduction.textContent = "No Active Production";
    noProduction.classList.add("text-gray-400", "italic");
    container.appendChild(noProduction);
    return container;
  }

  if (cameraView === CameraView.Medium) {
    const totalBuildings = activeProductions.reduce((total, production) => {
      const current = Number(production.buildingCount ?? 0);
      return total + (Number.isNaN(current) ? 0 : current);
    }, 0);

    const item = document.createElement("span");
    item.classList.add("px-1", "py-0.5", "rounded", "bg-black/30", "font-semibold");
    item.style.color = SOFT_LABEL_COLOR;
    const label = totalBuildings === 1 ? "Building" : "Buildings";
    item.textContent = `${label} ×${formatCompactNumber(totalBuildings)}`;
    container.appendChild(item);

    return container;
  }

  activeProductions.forEach((production) => {
    const productionDiv = document.createElement("div");
    productionDiv.classList.add("flex", "items-center", "gap-1", "bg-black/40", "rounded", "px-1.5", "py-0.5");

    const resourceName = BuildingTypeToIcon[production.buildingType];
    if (resourceName) {
      const iconContainer = document.createElement("div");
      iconContainer.classList.add("w-6", "h-6", "flex-shrink-0", "flex", "items-center", "justify-center");

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
    countSpan.classList.add("font-semibold", "text-xs");
    countSpan.style.color = SOFT_LABEL_COLOR;
    productionDiv.appendChild(countSpan);

    container.appendChild(productionDiv);
  });

  return container;
};

/**
 * Create content container with transition wrapper
 */
export const createContentContainer = (inputView: CameraView): HTMLElement & { wrapper: HTMLElement } => {
  const cameraView = resolveCameraView(inputView);
  const wrapperContainer = document.createElement("div");
  wrapperContainer.classList.add("transition-all", "duration-700", "ease-in-out", "overflow-hidden");
  wrapperContainer.setAttribute("data-component", "content-container-wrapper");

  const contentContainer = document.createElement("div");
  contentContainer.classList.add("flex", "flex-col", "w-max");
  contentContainer.setAttribute("data-component", "content-container");

  const spacerDiv = document.createElement("div");
  if (cameraView === CameraView.Medium) {
    spacerDiv.classList.add("w-1");
    contentContainer.classList.add("gap-1");
  } else if (cameraView === CameraView.Close) {
    spacerDiv.classList.add("w-2");
    contentContainer.classList.add("gap-1");
  } else {
    spacerDiv.classList.add("w-2");
  }

  if (cameraView !== CameraView.Far) {
    contentContainer.appendChild(spacerDiv);
  }

  wrapperContainer.appendChild(contentContainer);

  const expandedClasses =
    cameraView === CameraView.Medium
      ? ["max-w-[420px]", "ml-1.5", "opacity-100"]
      : ["max-w-[1000px]", "ml-2", "opacity-100"];
  const collapsedClasses = ["max-w-0", "max-h-0", "h-0", "ml-0", "opacity-0", "pointer-events-none"];

  if (cameraView === CameraView.Far) {
    wrapperContainer.classList.add(...collapsedClasses);
    wrapperContainer.style.setProperty("display", "none");
  } else {
    wrapperContainer.classList.add(...expandedClasses);
  }

  const result = contentContainer as unknown as HTMLElement & { wrapper: HTMLElement };
  result.wrapper = wrapperContainer;
  return result;
};

/**
 * Update an existing stamina bar with new values
 */
export const updateStaminaBar = (staminaBarElement: HTMLElement, currentStamina: number, maxStamina: number): void => {
  const percentElement = staminaBarElement.querySelector("[data-role='stamina-percent']") as HTMLElement | null;
  const progressFill = staminaBarElement.querySelector("[data-role='progress-fill']") as HTMLElement;
  const textElement = staminaBarElement.querySelector("[data-role='stamina-text']") as HTMLElement;

  if (percentElement) {
    percentElement.textContent = formatStaminaPercent(currentStamina, maxStamina);
  }

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

/**
 * Create a rotated arrow element
 * @param degrees - Degrees (0 is East, positive is clockwise)
 * @param color - CSS color class for the arrow
 * @returns HTMLElement with rotated arrow
 */
const createRotatedArrow = (degrees: number, colorClass: string): HTMLElement => {
  const arrowContainer = document.createElement("span");
  arrowContainer.style.display = "inline-block";
  arrowContainer.style.transform = `rotate(${degrees}deg)`;
  arrowContainer.style.transformOrigin = "center";
  arrowContainer.style.transition = "transform 0.3s ease";
  arrowContainer.textContent = "→"; // Single right arrow
  arrowContainer.classList.add(colorClass, "font-bold", "text-sm");
  return arrowContainer;
};

/**
 * Format time in seconds to MM:SS format
 */
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

/**
 * Create battle timer component
 */
export const createBattleTimer = (battleTimerLeft: number): HTMLElement => {
  const timerDiv = document.createElement("div");
  timerDiv.classList.add(
    "flex",
    "items-center",
    "gap-0.5",
    "px-1.5",
    "py-0.5",
    "rounded",
    "bg-red-900/40",
    "border",
    "border-red-500/30",
  );
  timerDiv.setAttribute("data-component", "battle-timer");

  // Timer icon
  const timerIcon = document.createElement("span");
  timerIcon.textContent = "⏱️";
  timerIcon.classList.add("text-xs");
  timerDiv.appendChild(timerIcon);

  // Timer text
  const timerText = document.createElement("span");
  timerText.textContent = formatTime(battleTimerLeft);
  timerText.classList.add("text-red-300", "font-mono", "text-xxs", "font-bold");
  timerText.setAttribute("data-role", "timer-text");
  timerDiv.appendChild(timerText);

  return timerDiv;
};

/**
 * Update battle timer
 */
export const updateBattleTimer = (timerElement: HTMLElement, battleTimerLeft: number): void => {
  const textElement = timerElement.querySelector("[data-role='timer-text']") as HTMLElement;
  if (textElement) {
    textElement.textContent = formatTime(battleTimerLeft);
  }
};

/**
 * Create direction indicator component with optional battle timer
 */
export const createDirectionIndicators = (
  attackedFromDegrees?: number,
  attackedTowardDegrees?: number,
  battleTimerLeft?: number,
): HTMLElement | null => {
  // Return null if no degrees to display
  if (attackedFromDegrees === undefined && attackedTowardDegrees === undefined) {
    return null;
  }

  const container = document.createElement("div");
  container.classList.add("flex", "items-center", "justify-center", "gap-1", "text-xxs", "animate-fade-in");
  container.setAttribute("data-component", "direction-indicators");

  // Attack direction (offensive) - emoji left, arrow right
  if (attackedTowardDegrees !== undefined) {
    const attackDiv = document.createElement("div");
    attackDiv.classList.add("flex", "items-center", "gap-0.5");

    // Attack icon (left)
    const attackIcon = document.createElement("span");
    attackIcon.textContent = "⚔️";
    attackIcon.classList.add("text-xs");
    attackDiv.appendChild(attackIcon);

    // Direction arrow (right)
    const attackArrow = createRotatedArrow(attackedTowardDegrees, "text-orange-500");
    attackDiv.appendChild(attackArrow);

    container.appendChild(attackDiv);
  }

  // Defense direction (defensive) - emoji left, arrow right
  if (attackedFromDegrees !== undefined) {
    const defenseDiv = document.createElement("div");
    defenseDiv.classList.add("flex", "items-center", "gap-0.5");

    // Defense icon (left)
    const defenseIcon = document.createElement("span");
    defenseIcon.textContent = "🛡️";
    defenseIcon.classList.add("text-xs");
    defenseDiv.appendChild(defenseIcon);

    // Direction arrow (right)
    const defenseArrow = createRotatedArrow(attackedFromDegrees, "text-blue-500");
    defenseDiv.appendChild(defenseArrow);

    container.appendChild(defenseDiv);
  }

  // Battle timer (if battle is active)
  if (battleTimerLeft !== undefined && battleTimerLeft > 0) {
    const battleTimer = createBattleTimer(battleTimerLeft);
    container.appendChild(battleTimer);
  }

  return container;
};

/**
 * Update direction indicators
 */
export const updateDirectionIndicators = (
  element: HTMLElement,
  attackedFromDegrees?: number,
  attackedTowardDegrees?: number,
  battleTimerLeft?: number,
): HTMLElement | null => {
  const existingIndicators = element.querySelector('[data-component="direction-indicators"]');

  if (attackedFromDegrees === undefined && attackedTowardDegrees === undefined) {
    existingIndicators?.remove();
    return null;
  }

  const newIndicators = createDirectionIndicators(attackedFromDegrees, attackedTowardDegrees, battleTimerLeft);

  if (!newIndicators) {
    existingIndicators?.remove();
    return null;
  }

  existingIndicators?.remove();
  return newIndicators;
};
