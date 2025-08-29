import { LabelConfig, LabelStyle } from "./label-types";

/**
 * Style definitions for different label types
 */
export const LABEL_STYLES = {
  MY_ARMY: {
    default: {
      backgroundColor: "rgba(34, 197, 94, 0.3)",
      borderColor: "rgba(34, 197, 94, 0.5)",
      textColor: "#d9f99d",
    },
    hover: {
      backgroundColor: "rgba(34, 197, 94, 0.5)",
    },
  },
  ENEMY_ARMY: {
    default: {
      backgroundColor: "rgba(239, 68, 68, 0.3)",
      borderColor: "rgba(239, 68, 68, 0.5)",
      textColor: "#fecdd3",
    },
    hover: {
      backgroundColor: "rgba(239, 68, 68, 0.5)",
    },
  },
  DAYDREAMS_AGENT: {
    default: {
      backgroundColor: "rgba(147, 51, 234, 0.3)",
      borderColor: "rgba(147, 51, 234, 0.5)",
      textColor: "#a855f7",
    },
    hover: {
      backgroundColor: "rgba(147, 51, 234, 0.5)",
    },
  },
  MY_STRUCTURE: {
    default: {
      backgroundColor: "rgba(34, 197, 94, 0.3)",
      borderColor: "rgba(34, 197, 94, 0.5)",
      textColor: "#d9f99d",
    },
    hover: {
      backgroundColor: "rgba(34, 197, 94, 0.5)",
    },
  },
  ENEMY_STRUCTURE: {
    default: {
      backgroundColor: "rgba(239, 68, 68, 0.3)",
      borderColor: "rgba(239, 68, 68, 0.5)",
      textColor: "#fecdd3",
    },
    hover: {
      backgroundColor: "rgba(239, 68, 68, 0.5)",
    },
  },
  CHEST: {
    backgroundColor: "rgba(251, 191, 36, 0.3)",
    borderColor: "rgba(245, 158, 11, 0.5)",
    textColor: "#fbbf24",
  },
  QUEST: {
    backgroundColor: "rgba(251, 191, 36, 0.3)",
    borderColor: "rgba(245, 158, 11, 0.5)",
    textColor: "#fbbf24",
  },
} as const;

/**
 * Get ownership-based styling
 */
export function getOwnershipStyle(
  isMine: boolean,
  isDaydreamsAgent?: boolean,
): {
  default: LabelStyle;
  hover: LabelStyle;
} {
  if (isDaydreamsAgent) {
    return LABEL_STYLES.DAYDREAMS_AGENT;
  }
  return isMine ? LABEL_STYLES.MY_ARMY : LABEL_STYLES.ENEMY_ARMY;
}

/**
 * Default configurations for different label types
 */
export const LABEL_TYPE_CONFIGS: Record<string, LabelConfig> = {
  ARMY: {
    baseClasses: [
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
    ],
    positionOffset: { x: 0, y: 2.1, z: 0 },
    renderOrder: 100,
    updatable: true,
    transitions: {
      duration: 300,
      easing: "ease-in-out",
      collapseBehavior: "delayed",
      collapseDelay: 100,
    },
  },
  STRUCTURE: {
    baseClasses: [
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
    ],
    positionOffset: { x: 0, y: 2.1, z: 0 },
    renderOrder: 90,
    updatable: true,
    transitions: {
      duration: 300,
      easing: "ease-in-out",
      collapseBehavior: "delayed",
      collapseDelay: 100,
    },
  },
  CHEST: {
    baseClasses: [
      "rounded-md",
      "p-0.5",
      "-translate-x-1/2",
      "text-xxs",
      "flex",
      "items-center",
      "group",
      "shadow-md",
      "font-semibold",
    ],
    positionOffset: { x: 0, y: 1.5, z: 0 },
    renderOrder: 80,
    updatable: false,
  },
  QUEST: {
    baseClasses: [
      "rounded-md",
      "p-0.5",
      "-translate-x-1/2",
      "text-xxs",
      "flex",
      "items-center",
      "group",
      "shadow-md",
      "font-semibold",
    ],
    positionOffset: { x: 0, y: 1.5, z: 0 },
    renderOrder: 85,
    updatable: false,
  },
};
