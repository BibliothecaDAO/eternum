import { CameraView } from "@/three/scenes/hexagon-scene";
import { COLORS } from "@/ui/features/settlement";
import { BuildingType, ResourcesIds, TroopTier } from "@bibliothecadao/types";

// In-memory database for managing label transitions
interface LabelTransitionRecord {
  id: string;
  timestamp: number;
  timeoutId?: number;
  type: "medium" | "close" | "far";
  entityType?: string;
  entityId?: string;
}

class LabelTransitionDB {
  private static instance: LabelTransitionDB;
  private records: Map<string, LabelTransitionRecord> = new Map();
  private indices: {
    byType: Map<string, Set<string>>;
    byEntity: Map<string, Set<string>>;
  } = {
    byType: new Map(),
    byEntity: new Map(),
  };

  private constructor() {}

  static getInstance(): LabelTransitionDB {
    if (!LabelTransitionDB.instance) {
      LabelTransitionDB.instance = new LabelTransitionDB();
    }
    return LabelTransitionDB.instance;
  }

  // Database operations
  private addIndex(record: LabelTransitionRecord): void {
    // Index by type
    if (!this.indices.byType.has(record.type)) {
      this.indices.byType.set(record.type, new Set());
    }
    this.indices.byType.get(record.type)!.add(record.id);

    // Index by entity if available
    if (record.entityType && record.entityId) {
      const entityKey = `${record.entityType}:${record.entityId}`;
      if (!this.indices.byEntity.has(entityKey)) {
        this.indices.byEntity.set(entityKey, new Set());
      }
      this.indices.byEntity.get(entityKey)!.add(record.id);
    }
  }

  private removeIndex(record: LabelTransitionRecord): void {
    // Remove from type index
    this.indices.byType.get(record.type)?.delete(record.id);

    // Remove from entity index if available
    if (record.entityType && record.entityId) {
      const entityKey = `${record.entityType}:${record.entityId}`;
      this.indices.byEntity.get(entityKey)?.delete(record.id);
    }
  }

  private clearTimeout(id: string): void {
    const record = this.records.get(id);
    if (record?.timeoutId) {
      window.clearTimeout(record.timeoutId);
      // Update record
      record.timeoutId = undefined;
      this.records.set(id, record);
    }
  }

  // Public API
  set(id: string, type: "medium" | "close" | "far", entityType?: string, entityId?: string): void {
    // Transaction-like behavior: get and clear existing record first
    this.delete(id);

    // Create new record
    const record: LabelTransitionRecord = {
      id,
      timestamp: Date.now(),
      type,
      entityType,
      entityId,
    };

    // Store and index
    this.records.set(id, record);
    this.addIndex(record);
  }

  get(id: string): LabelTransitionRecord | undefined {
    return this.records.get(id);
  }

  delete(id: string): void {
    const record = this.records.get(id);
    if (record) {
      // Clean up timeout if exists
      this.clearTimeout(id);
      // Remove from indices
      this.removeIndex(record);
      // Remove record
      this.records.delete(id);
    }
  }

  query(type?: string, entityType?: string, entityId?: string): LabelTransitionRecord[] {
    // Simple query by type
    if (type && !entityType) {
      const ids = this.indices.byType.get(type) || new Set();
      return Array.from(ids).map((id) => this.records.get(id)!);
    }

    // Query by entity
    if (entityType && entityId) {
      const entityKey = `${entityType}:${entityId}`;
      const ids = this.indices.byEntity.get(entityKey) || new Set();
      return Array.from(ids)
        .map((id) => this.records.get(id)!)
        .filter((record) => !type || record.type === type);
    }

    // Return all records if no filters
    return Array.from(this.records.values());
  }

  // Specific methods for label transitions
  setMediumViewTransition(id: string, entityType?: string, entityId?: string): void {
    this.set(id, "medium", entityType, entityId);
  }

  getMediumViewExpanded(id: string): boolean {
    const record = this.get(id);
    return record && record.type === "medium" ? Date.now() - record.timestamp < 2000 : false;
  }

  clearMediumViewTransition(id: string): void {
    this.delete(id);
  }

  scheduleTimeout(id: string, callback: () => void, ms: number): void {
    const record = this.records.get(id);
    if (record) {
      // Clear existing timeout
      this.clearTimeout(id);

      // Set new timeout
      const timeoutId = window.setTimeout(() => {
        callback();
        // Update record to show timeout completed
        if (this.records.has(id)) {
          const updatedRecord = this.records.get(id)!;
          updatedRecord.timeoutId = undefined;
          this.records.set(id, updatedRecord);
        }
      }, ms);

      // Update record with new timeout ID
      record.timeoutId = timeoutId;
      this.records.set(id, record);
    }
  }

  // Clear all expired records (useful for periodic cleanup)
  cleanupExpired(maxAge: number = 5000): number {
    const now = Date.now();
    let cleanedCount = 0;

    this.records.forEach((record, id) => {
      if (!record.timeoutId && now - record.timestamp > maxAge) {
        this.delete(id);
        cleanedCount++;
      }
    });

    return cleanedCount;
  }
}

export const transitionDB = LabelTransitionDB.getInstance();

// Custom label styling based on ownership - using direct colors for more reliable rendering
export const LABEL_STYLES = {
  MINE: {
    bgColor: "rgba(30, 95, 55, 0.3)", // even more transparent
    hoverColor: "rgba(22, 101, 52, 0.4)",
    textColor: "#d9f99d", // brighter lime for better visibility
    borderColor: "rgba(22, 163, 74, 0.5)",
  },
  ALLY: {
    bgColor: "rgba(40, 70, 150, 0.3)", // even more transparent
    hoverColor: "rgba(30, 64, 175, 0.4)",
    textColor: "#bae6fd", // brighter sky blue
    borderColor: "rgba(37, 99, 235, 0.5)",
  },
  ENEMY: {
    bgColor: "rgba(140, 40, 40, 0.3)", // even more transparent
    hoverColor: "rgba(153, 27, 27, 0.4)",
    textColor: "#fecdd3", // brighter rose
    borderColor: "rgba(220, 38, 38, 0.5)",
  },
  DAYDREAMS: {
    bgColor: "rgba(70, 70, 70, 0.8)", // lighter gray
    hoverColor: "rgba(90, 90, 90, 0.85)",
    textColor: COLORS.SELECTED, // use the selected color from COLORS
    borderColor: "rgba(220, 220, 220, 0.5)",
  },
};

// Helper to clean text with null characters
const cleanText = (text?: string) => {
  if (!text) return "";
  // Convert to string, filter out null characters, then trim whitespace
  return text
    .toString()
    .split("")
    .filter((char) => char.charCodeAt(0) !== 0)
    .join("")
    .trim();
};

// Guild badge color utilities
const getGuildColorSet = (guildName: string) => {
  const cleanedName = cleanText(guildName);

  // Different gradient combinations based on first letter
  const colorSets = [
    ["from-emerald-600/60", "to-emerald-800/60", "border-emerald-500/30"], // a-d
    ["from-amber-600/60", "to-amber-800/60", "border-amber-500/30"], // i-l
    ["from-violet-600/60", "to-violet-800/60", "border-violet-500/30"], // e-h
    ["from-cyan-600/60", "to-cyan-800/60", "border-cyan-500/30"], // m-p
    ["from-rose-600/60", "to-rose-800/60", "border-rose-500/30"], // q-t
    ["from-blue-600/60", "to-blue-800/60", "border-blue-500/30"], // u-z
    ["from-orange-600/60", "to-red-700/60", "border-orange-500/30"], // other
  ];

  // If empty after cleaning, default to "A"
  const firstChar = cleanedName.length > 0 ? cleanedName.charAt(0).toLowerCase() : "a";
  const charCode = firstChar.charCodeAt(0);

  let index = Math.floor((charCode - 97) / 4);
  if (index < 0 || index >= colorSets.length) {
    index = colorSets.length - 1;
  }

  return {
    colorSet: colorSets[index],
    cleanedName,
    firstChar,
  };
};

// Create owner display components (name + guild badge)
interface OwnerDisplayOptions {
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

export const createOwnerDisplayElement = (options: OwnerDisplayOptions) => {
  const { owner, isMine, isAlly, color, isDaydreamsAgent } = options;

  // Create container
  const container = document.createElement("div");
  container.classList.add("flex", "items-center", "truncate", "gap-1");

  // Create name element
  const displayName = owner.ownerName || ``;
  const nameSpan = document.createElement("span");
  nameSpan.textContent = displayName;
  nameSpan.classList.add("font-medium");

  // Force specific colors based on ownership for structures
  let finalTextColor: string;

  if (isDaydreamsAgent) {
    finalTextColor = LABEL_STYLES.DAYDREAMS.textColor;
  } else if (color) {
    finalTextColor = color;
  } else {
    // Explicitly determine color based on ownership
    if (isMine === true) {
      finalTextColor = LABEL_STYLES.MINE.textColor;
    } else if (isAlly === true) {
      finalTextColor = LABEL_STYLES.ALLY.textColor;
    } else {
      finalTextColor = LABEL_STYLES.ENEMY.textColor;
    }
  }

  // Apply the final color and make it !important to override any other styles
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

// Create common content container with proper transitions for different camera views
export const createContentContainer = (cameraView: CameraView) => {
  // Create wrapper for width transition
  const wrapperContainer = document.createElement("div");
  wrapperContainer.classList.add("transition-all", "duration-700", "ease-in-out", "overflow-hidden");

  // Create inner container for content
  const contentContainer = document.createElement("div");
  contentContainer.classList.add("flex", "flex-col", "gap-y-1", "w-max");

  // Add empty div with w-2 for spacing
  const spacerDiv = document.createElement("div");
  spacerDiv.classList.add("w-2");
  contentContainer.appendChild(spacerDiv);

  // Generate a unique ID for this container to manage its transitions
  const containerId = `container_${Math.random().toString(36).substring(2, 9)}`;
  (wrapperContainer as HTMLElement).dataset.containerId = containerId;

  // Check if we have an active medium view transition
  const mediumViewExpanded = transitionDB.getMediumViewExpanded(containerId);

  const wrapperStyle = ["max-w-[1000px]", "ml-2", "opacity-100"];
  const wrapperStyleCollapsed = ["max-w-0", "ml-0", "opacity-0", "pointer-events-none"];

  // Put content inside wrapper
  wrapperContainer.appendChild(contentContainer);

  // Set initial state based on camera view
  if (cameraView === CameraView.Far || (cameraView === CameraView.Medium && !mediumViewExpanded)) {
    wrapperContainer.classList.add(...wrapperStyleCollapsed);
  } else {
    wrapperContainer.classList.add(...wrapperStyle);

    // For Medium view, add a timeout to revert to Far view style after 2 seconds
    if (cameraView === CameraView.Medium) {
      // Store the current timestamp
      transitionDB.setMediumViewTransition(containerId);

      transitionDB.scheduleTimeout(
        containerId,
        () => {
          // Only apply the transition if the element is still in the DOM
          if (wrapperContainer.isConnected) {
            wrapperContainer.classList.remove(...wrapperStyle);
            wrapperContainer.classList.add(...wrapperStyleCollapsed);
            // Clear the timestamp when the transition is complete
            transitionDB.clearMediumViewTransition(containerId);
          }
        },
        2000,
      );
    }
  }

  // Return contentContainer so the rest of the code can append children to it
  (contentContainer as any).wrapper = wrapperContainer; // Store reference to wrapper
  return contentContainer;
};

// Create common label base with shared properties
interface LabelBaseOptions {
  isMine: boolean;
  isAlly?: boolean;
  textColor?: string;
  isDaydreamsAgent?: boolean;
}

export const createLabelBase = (options: LabelBaseOptions) => {
  const { isMine, isAlly, textColor, isDaydreamsAgent } = options;

  const labelDiv = document.createElement("div");

  // Add common classes
  labelDiv.classList.add(
    "rounded-md",
    "pointer-events-auto",
    // "h-",
    "p-0.5",
    "-translate-x-1/2",
    "text-xxs",
    "flex",
    "items-center",
    "group",
    "shadow-md",
    "font-semibold",
  );

  // Apply direct style properties for more reliable rendering
  let style;

  // Special case for Daydreams agents
  if (isDaydreamsAgent === true) {
    style = LABEL_STYLES.DAYDREAMS;
  } else if (isMine === true) {
    style = LABEL_STYLES.MINE;
  } else if (isAlly === true) {
    style = LABEL_STYLES.ALLY;
  } else {
    style = LABEL_STYLES.ENEMY;
  }

  // Apply styles directly with !important to ensure they override any other styles
  labelDiv.style.setProperty("background-color", style.bgColor, "important");
  labelDiv.style.setProperty("border", `1px solid ${style.borderColor}`, "important");

  // If textColor is provided, use it; otherwise, use the default from style
  const finalTextColor = textColor || style.textColor;
  labelDiv.style.setProperty("color", finalTextColor, "important");

  // Add hover effect
  labelDiv.addEventListener("mouseenter", () => {
    labelDiv.style.setProperty("background-color", style.hoverColor, "important");
  });

  labelDiv.addEventListener("mouseleave", () => {
    labelDiv.style.setProperty("background-color", style.bgColor, "important");
  });

  // Prevent right click
  labelDiv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  return labelDiv;
};

// Troop tier to stars mapping
export const TIERS_TO_STARS = {
  [TroopTier.T1]: "⭐",
  [TroopTier.T2]: "⭐⭐",
  [TroopTier.T3]: "⭐⭐⭐",
};

// Enhanced army information display utilities
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

export const createTroopCountDisplay = (count: number, troopType: string, tier: string): HTMLElement => {
  const container = document.createElement("div");
  container.classList.add("flex", "items-center", "text-xxs", "gap-1");
  container.setAttribute("data-component", "troop-count");

  // Troop count
  const countSpan = document.createElement("strong");
  countSpan.textContent = count.toString();
  countSpan.classList.add("text-white");
  countSpan.setAttribute("data-role", "count");
  container.appendChild(countSpan);

  // Troop type and tier
  const typeSpan = document.createElement("span");
  typeSpan.textContent = `${troopType} ${TIERS_TO_STARS[tier as TroopTier] || ""}`;
  typeSpan.classList.add("text-gray-300");
  container.appendChild(typeSpan);

  return container;
};

// Helper function to get troop resource ID from category name
const getTroopResourceIdFromCategory = (category: string | null): number | null => {
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

export const getTierStyle = (tier: number) => {
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

  console.log({ activeProductions });

  activeProductions.forEach((production, index) => {
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

// Export the transitionManager alias for backward compatibility
export const transitionManager = {
  setMediumViewTransition: (id: string = "global", entityType?: string, entityId?: string) =>
    transitionDB.setMediumViewTransition(id, entityType, entityId),
  getMediumViewExpanded: (id: string = "global") => transitionDB.getMediumViewExpanded(id),
  clearMediumViewTransition: (id: string = "global") => transitionDB.clearMediumViewTransition(id),
  setLabelTimeout: (callback: () => void, ms: number, id: string = "global") =>
    transitionDB.scheduleTimeout(id, callback, ms),
  clearTimeout: (id: string = "global") => transitionDB.delete(id),
};

// Centralized camera view transition handling for existing labels
export const applyLabelTransitions = (labelsMap: Map<any, any>, cameraView: CameraView) => {
  const styleExtended = ["max-w-[1000px]", "ml-2", "opacity-100"];
  const styleCollapsed = ["max-w-0", "ml-0", "opacity-0", "pointer-events-none"];

  labelsMap.forEach((label, entityId) => {
    if (label.element) {
      // Look for the wrapper div with transition classes
      const wrapperContainer = label.element.querySelector(".transition-all.duration-700");
      if (wrapperContainer) {
        // Get or create a container ID for tracking timeouts
        let containerId = (wrapperContainer as HTMLElement).dataset.containerId;
        if (!containerId) {
          containerId = `structure_${entityId}_${Math.random().toString(36).substring(2, 9)}`;
          (wrapperContainer as HTMLElement).dataset.containerId = containerId;
        }

        console.log("applyLabelTransitions - cameraView:", cameraView, "entityId:", entityId);

        // Remove all existing styles first
        wrapperContainer.classList.remove(...styleExtended, ...styleCollapsed);

        if (cameraView === CameraView.Far) {
          // For Far view, always collapse immediately
          console.log("applyLabelTransitions - collapsing for Far view");
          wrapperContainer.classList.add(...styleCollapsed);
          transitionManager.clearTimeout(containerId);
        } else if (cameraView === CameraView.Close) {
          // For Close view, always expand and never collapse
          console.log("applyLabelTransitions - expanding for Close view");
          wrapperContainer.classList.add(...styleExtended);
          transitionManager.clearTimeout(containerId);
        } else if (cameraView === CameraView.Medium) {
          // For Medium view, expand initially
          console.log("applyLabelTransitions - expanding for Medium view with timeout");
          wrapperContainer.classList.add(...styleExtended);

          // And set up timeout to collapse after 2 seconds
          transitionManager.setMediumViewTransition(containerId);
          transitionManager.setLabelTimeout(
            () => {
              if (wrapperContainer.isConnected) {
                console.log("applyLabelTransitions - Medium timeout: collapsing");
                wrapperContainer.classList.remove(...styleExtended);
                wrapperContainer.classList.add(...styleCollapsed);
                transitionManager.clearMediumViewTransition(containerId);
              }
            },
            2000,
            containerId,
          );
        }
      }
    }
  });
};

// Structure label creation functionality moved from structure-manager.ts
import { getIsBlitz } from "@/ui/constants";
import { getStructureTypeName } from "@bibliothecadao/eternum";
import { getLevelName, StructureType } from "@bibliothecadao/types";

const STRUCTURE_ICONS = {
  STRUCTURES: {
    [StructureType.Village]: "/images/labels/enemy_village.png",
    [StructureType.Realm]: "/images/labels/enemy_realm.png",
    [StructureType.Hyperstructure]: "/images/labels/hyperstructure.png",
    [StructureType.Bank]: `/images/resources/${ResourcesIds.Lords}.png`,
    [StructureType.FragmentMine]: "/images/labels/fragment_mine.png",
  } as Record<StructureType, string>,
  MY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/village.png",
    [StructureType.Realm]: "/images/labels/realm.png",
  } as Record<StructureType, string>,
  ALLY_STRUCTURES: {
    [StructureType.Village]: "/images/labels/allies_village.png",
    [StructureType.Realm]: "/images/labels/allies_realm.png",
  } as Record<StructureType, string>,
};

interface StructureInfo {
  entityId: number;
  hexCoords: { col: number; row: number };
  structureType: StructureType;
  stage: number;
  initialized: boolean;
  level: number;
  isMine: boolean;
  isAlly: boolean;
  hasWonder: boolean;
  owner: {
    address: bigint;
    ownerName: string;
    guildName: string;
  };
  guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>;
  activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>;
}

// Create structure info label - centralized from structure-manager.ts
export const createStructureLabel = (structure: StructureInfo, cameraView: CameraView): HTMLElement => {
  const isBlitz = getIsBlitz();

  // Create label div using the shared base
  const labelDiv = createLabelBase({
    isMine: structure.isMine,
    isAlly: structure.isAlly,
  });

  // Create icon container
  const iconContainer = document.createElement("div");
  iconContainer.classList.add("w-auto", "h-full", "flex-shrink-0");

  // Select appropriate icon
  let iconPath = STRUCTURE_ICONS.STRUCTURES[structure.structureType];
  if (structure.structureType === StructureType.Realm || structure.structureType === StructureType.Village) {
    iconPath = structure.isMine
      ? STRUCTURE_ICONS.MY_STRUCTURES[structure.structureType]
      : structure.isAlly
        ? STRUCTURE_ICONS.ALLY_STRUCTURES[structure.structureType]
        : STRUCTURE_ICONS.STRUCTURES[structure.structureType];
  }

  // Create and set icon image
  const iconImg = document.createElement("img");
  iconImg.src = iconPath;
  iconImg.classList.add("w-10", "h-10", "object-contain");
  iconImg.setAttribute("data-component", "structure-icon");
  iconContainer.appendChild(iconImg);
  labelDiv.appendChild(iconContainer);

  // Create content container with transition using shared utility
  const contentContainer = createContentContainer(cameraView);

  // Add owner display using shared component
  const ownerText = createOwnerDisplayElement({
    owner: structure.owner,
    isMine: structure.isMine,
    isAlly: structure.isAlly,
    cameraView,
  });
  contentContainer.appendChild(ownerText);

  // Add structure type and level
  const typeText = document.createElement("strong");
  typeText.textContent = `${getStructureTypeName(structure.structureType, isBlitz)} ${structure.structureType === StructureType.Realm ? `(${getLevelName(structure.level)})` : ""} ${
    structure.structureType === StructureType.Hyperstructure
      ? structure.initialized
        ? `(Stage ${structure.stage + 1})`
        : "Foundation"
      : ""
  }`;
  contentContainer.appendChild(typeText);

  // Add guard armies display if available
  if (structure.guardArmies && structure.guardArmies.length > 0) {
    const guardArmiesDisplay = createGuardArmyDisplay(structure.guardArmies);
    contentContainer.appendChild(guardArmiesDisplay);
  }

  // Add active productions display if available
  if (structure.activeProductions && structure.activeProductions.length > 0) {
    const productionsDisplay = createProductionDisplay(structure.activeProductions);
    contentContainer.appendChild(productionsDisplay);
  }

  labelDiv.appendChild((contentContainer as any).wrapper || contentContainer);
  return labelDiv;
};

const BuildingTypeToIcon: Partial<Record<BuildingType, string>> = {
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

// Army label creation functionality moved from army-manager.ts
import { Position } from "@/types/position";
import { getCharacterName } from "@/utils/agent";
import { getTroopName } from "@bibliothecadao/eternum";
import { TroopType } from "@bibliothecadao/types";

interface ArmyInfo {
  entityId: number;
  hexCoords: Position;
  category: TroopType;
  tier: TroopTier;
  isMine: boolean;
  isAlly: boolean;
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

// Create army info label - centralized from army-manager.ts
export const createArmyLabel = (army: ArmyInfo, cameraView: CameraView): HTMLElement => {
  // Create base label using shared utility
  const labelDiv = createLabelBase({
    isMine: army.isMine,
    isAlly: army.isAlly,
    isDaydreamsAgent: army.isDaydreamsAgent,
  });

  // Add army icon
  const img = document.createElement("img");
  img.src = army.isDaydreamsAgent
    ? "/images/logos/daydreams.png"
    : `/images/labels/${army.isMine ? "army" : army.isAlly ? "allies_army" : "enemy_army"}.png`;
  img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
  img.setAttribute("data-component", "army-icon");
  labelDiv.appendChild(img);

  // Create text container with transition using shared utility
  const textContainer = createContentContainer(cameraView);

  // Add owner information using shared component
  const line1 = createOwnerDisplayElement({
    owner: army.owner,
    isMine: army.isMine,
    isAlly: army.isAlly,
    cameraView,
    color: army.color,
    isDaydreamsAgent: army.isDaydreamsAgent,
  });

  // Add troop type information with consistent styling
  const line2 = document.createElement("strong");
  if (army.isDaydreamsAgent) {
    line2.textContent = `${getCharacterName(army.tier, army.category, army.entityId)}`;
  } else {
    line2.textContent = `${getTroopName(army.category, army.tier)} ${TIERS_TO_STARS[army.tier] || ""}`;
  }

  textContainer.appendChild(line1);
  textContainer.appendChild(line2);

  // Add enhanced troop count display if available
  if (army.troopCount !== undefined) {
    const troopCountDisplay = createTroopCountDisplay(army.troopCount, army.category, army.tier);
    textContainer.appendChild(troopCountDisplay);
  }

  // Add stamina bar if data is available
  if (army.currentStamina !== undefined && army.maxStamina !== undefined && army.maxStamina > 0) {
    const staminaBar = createStaminaBar(army.currentStamina, army.maxStamina);
    textContainer.appendChild(staminaBar);
  } else if (army.currentStamina !== undefined) {
    // Show just current stamina if max is not available
    const staminaInfo = document.createElement("div");
    staminaInfo.classList.add("flex", "items-center", "text-xxs", "gap-1");

    const staminaIcon = document.createElement("span");
    staminaIcon.textContent = "⚡";
    staminaIcon.classList.add("text-yellow-400");
    staminaInfo.appendChild(staminaIcon);

    const staminaText = document.createElement("span");
    staminaText.textContent = `${army.currentStamina}`;
    staminaText.classList.add("text-white", "font-mono");
    staminaInfo.appendChild(staminaText);

    textContainer.appendChild(staminaInfo);
  }

  labelDiv.appendChild((textContainer as any).wrapper || textContainer);

  return labelDiv;
};

/**
 * Update an existing army label with new data
 */
export const updateArmyLabel = (labelElement: HTMLElement, army: ArmyInfo): void => {
  // Verify the army icon is still present (debugging)
  const armyIcon = labelElement.querySelector('[data-component="army-icon"]') as HTMLElement;
  if (!armyIcon) {
    console.warn("Army icon missing during update, label may have been corrupted");
  }

  // Update stamina bar if it exists
  const staminaBar = labelElement.querySelector('[data-component="stamina-bar"]') as HTMLElement;
  if (staminaBar && army.currentStamina !== undefined && army.maxStamina !== undefined) {
    updateStaminaBar(staminaBar, army.currentStamina, army.maxStamina);
  }

  // Update troop count display if it exists
  const troopCountElement = labelElement.querySelector('[data-component="troop-count"]') as HTMLElement;
  if (troopCountElement && army.troopCount !== undefined) {
    const countSpan = troopCountElement.querySelector('[data-role="count"]') as HTMLElement;
    if (countSpan) {
      countSpan.textContent = army.troopCount.toString();
    }
  }

  // Update simple stamina display if stamina bar doesn't exist but stamina info does
  if (!staminaBar && army.currentStamina !== undefined) {
    const staminaInfo = labelElement.querySelector(".text-yellow-400")?.parentElement;
    if (staminaInfo) {
      const staminaText = staminaInfo.querySelector(".font-mono") as HTMLElement;
      if (staminaText) {
        staminaText.textContent = `${army.currentStamina}`;
      }
    }
  }
};

/**
 * Update an existing structure label with new data
 */
export const updateStructureLabel = (labelElement: HTMLElement, structure: StructureInfo): void => {
  // Verify the structure icon is still present (debugging)
  const structureIcon = labelElement.querySelector('[data-component="structure-icon"]') as HTMLElement;
  if (!structureIcon) {
    console.warn("Structure icon missing during update, label may have been corrupted");
  }

  // Update guard armies display if it exists
  const guardDisplay = labelElement.querySelector('[data-component="guard-armies"]') as HTMLElement;
  if (guardDisplay && structure.guardArmies) {
    // Recreate the entire guard display to ensure proper layout
    const newGuardDisplay = createGuardArmyDisplay(structure.guardArmies);

    // Replace the content while preserving the container
    guardDisplay.innerHTML = "";
    while (newGuardDisplay.firstChild) {
      guardDisplay.appendChild(newGuardDisplay.firstChild);
    }
  }

  // Update active productions display if it exists
  const productionsDisplay = labelElement.querySelector('[data-component="productions"]') as HTMLElement;
  if (productionsDisplay && structure.activeProductions) {
    // Recreate the entire productions display to ensure proper layout
    const newProductionsDisplay = createProductionDisplay(structure.activeProductions);

    // Replace the content while preserving the container
    productionsDisplay.innerHTML = "";
    while (newProductionsDisplay.firstChild) {
      productionsDisplay.appendChild(newProductionsDisplay.firstChild);
    }
  }
};

// Chest label creation functionality
interface ChestInfo {
  entityId: number;
  hexCoords: Position;
}

const CHEST_ICON_PATH = "/images/labels/chest.png";

export const createChestLabel = (chest: ChestInfo, cameraView: CameraView): HTMLElement => {
  // Create label div using the shared base
  const labelDiv = createLabelBase({
    isMine: false, // Chests don't have ownership
    textColor: "#fbbf24", // Use amber-400 color for chests
  });

  // Add chest icon
  const img = document.createElement("img");
  img.src = CHEST_ICON_PATH;
  img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
  img.setAttribute("data-component", "chest-icon");
  labelDiv.appendChild(img);

  // Create content container with transition using shared utility
  const contentContainer = createContentContainer(cameraView);

  // Add chest label
  const line1 = document.createElement("span");
  line1.textContent = `Chest`;
  line1.style.color = "inherit";

  contentContainer.appendChild(line1);

  labelDiv.appendChild((contentContainer as any).wrapper || contentContainer);

  return labelDiv;
};

/**
 * Update an existing stamina bar with new values
 */
export const updateStaminaBar = (staminaBarElement: HTMLElement, currentStamina: number, maxStamina: number): void => {
  const progressFill = staminaBarElement.querySelector("div > div") as HTMLElement; // The progress fill element
  const textElement = staminaBarElement.querySelector("span:last-child") as HTMLElement; // The text element

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
