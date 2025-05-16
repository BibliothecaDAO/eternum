import { CameraView } from "@/three/scenes/hexagon-scene";
import { COLORS } from "@/ui/components/settlement/settlement-constants";
import { TroopTier } from "@bibliothecadao/types";

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
export const cleanText = (text?: string) => {
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
export const getGuildColorSet = (guildName: string) => {
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

export const createOwnerDisplayElement = (options: OwnerDisplayOptions) => {
  const { owner, isMine, isAlly, color, isDaydreamsAgent } = options;

  // Create container
  const container = document.createElement("div");
  container.classList.add("flex", "items-center", "truncate", "gap-1");

  // Create name element
  const displayName = owner.ownerName || `0x${owner.address.toString(16).slice(0, 6)}...`;
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
    cameraView === CameraView.Far ? "max-w-0" : "max-w-[250px]",
    cameraView === CameraView.Far ? "ml-0" : "ml-2",
  );

  return contentContainer;
};

// Create common label base with shared properties
export interface LabelBaseOptions {
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
