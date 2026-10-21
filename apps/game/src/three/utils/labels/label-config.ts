import { LabelConfig, LabelStyle } from "./label-types";

/**
 * Predefined label styles for different ownership states
 */
export const LABEL_STYLES: Record<string, LabelStyle> = {
  MINE: {
    backgroundColor: "rgba(30, 95, 55, 0.3)",
    textColor: "#d9f99d",
    borderColor: "rgba(22, 163, 74, 0.5)",
  },
  ALLY: {
    backgroundColor: "rgba(40, 70, 150, 0.3)",
    textColor: "#bae6fd",
    borderColor: "rgba(37, 99, 235, 0.5)",
  },
  ENEMY: {
    backgroundColor: "rgba(140, 40, 40, 0.3)",
    textColor: "#fecdd3",
    borderColor: "rgba(220, 38, 38, 0.5)",
  },
  NEUTRAL: {
    backgroundColor: "rgba(70, 70, 70, 0.3)",
    textColor: "#e5e7eb",
    borderColor: "rgba(156, 163, 175, 0.5)",
  },
  CHEST: {
    backgroundColor: "rgba(251, 191, 36, 0.3)",
    textColor: "#fbbf24",
    borderColor: "rgba(245, 158, 11, 0.5)",
  },
};

/**
 * Hover styles that correspond to base styles
 */
const HOVER_STYLES: Record<string, LabelStyle> = {
  MINE: {
    backgroundColor: "rgba(22, 101, 52, 0.4)",
  },
  ALLY: {
    backgroundColor: "rgba(30, 64, 175, 0.4)",
  },
  ENEMY: {
    backgroundColor: "rgba(153, 27, 27, 0.4)",
  },
  NEUTRAL: {
    backgroundColor: "rgba(90, 90, 90, 0.4)",
  },
  CHEST: {
    backgroundColor: "rgba(245, 158, 11, 0.4)",
  },
};

/**
 * Base configuration shared by all label types
 */
const BASE_LABEL_CONFIG: LabelConfig = {
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
  transitions: {
    duration: 700,
    easing: "ease-in-out",
    collapseBehavior: "delayed",
    collapseDelay: 2000,
  },
  positionOffset: { x: 0, y: 2, z: 0 },
  renderOrder: 0,
  updatable: true,
};

/**
 * Predefined label type configurations
 */
export const LABEL_TYPE_CONFIGS = {
  ARMY: {
    ...BASE_LABEL_CONFIG,
    positionOffset: { x: 0, y: 2.1, z: 0 },
  },
  STRUCTURE: {
    ...BASE_LABEL_CONFIG,
    positionOffset: { x: 0, y: 2, z: 0 },
  },
  CHEST: {
    ...BASE_LABEL_CONFIG,
    positionOffset: { x: 0, y: 1.5, z: 0 },
  },
};

/**
 * Get the appropriate style based on ownership and state
 */
export function getOwnershipStyle(isMine: boolean): { default: LabelStyle; hover: LabelStyle } {
  let styleKey = "ENEMY";

  if (isMine) {
    styleKey = "MINE";
  }

  return {
    default: LABEL_STYLES[styleKey],
    hover: HOVER_STYLES[styleKey],
  };
}
