import { CameraView } from "@/three/scenes/hexagon-scene";
import { COLORS } from "@/ui/components/settlement/settlement-constants";
import { TroopTier } from "@bibliothecadao/types";

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
  const contentContainer = document.createElement("div");

  // Add empty div with w-2 for spacing
  const spacerDiv = document.createElement("div");
  spacerDiv.classList.add("w-2");
  contentContainer.appendChild(spacerDiv);

  contentContainer.classList.add(
    "flex",
    "flex-col",
    "transition-width",
    "duration-700",
    "ease-in-out",
    "overflow-hidden",
    "whitespace-nowrap",
    "group-hover:max-w-[250px]",
    "group-hover:ml-2",
  );

  // Generate a unique ID for this container to manage its transitions
  const containerId = `container_${Math.random().toString(36).substring(2, 9)}`;
  (contentContainer as HTMLElement).dataset.containerId = containerId;

  // Check if we have an active medium view transition
  const mediumViewExpanded = transitionDB.getMediumViewExpanded(containerId);

  // Set initial state based on camera view
  if (cameraView === CameraView.Far || (cameraView === CameraView.Medium && !mediumViewExpanded)) {
    contentContainer.classList.add("max-w-0", "ml-0");
  } else {
    contentContainer.classList.add("max-w-[250px]", "ml-2");

    // For Medium view, add a timeout to revert to Far view style after 2 seconds
    if (cameraView === CameraView.Medium) {
      // Store the current timestamp
      transitionDB.setMediumViewTransition(containerId);

      transitionDB.scheduleTimeout(
        containerId,
        () => {
          // Only apply the transition if the element is still in the DOM
          if (contentContainer.isConnected) {
            contentContainer.classList.remove("max-w-[250px]", "ml-2");
            contentContainer.classList.add("max-w-0", "ml-0");
            // Clear the timestamp when the transition is complete
            transitionDB.clearMediumViewTransition(containerId);
          }
        },
        2000,
      );
    }
  }

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
    "h-10",
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
