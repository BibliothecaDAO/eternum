import type { CameraView } from "../../scenes/hexagon-scene";
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
  DAYDREAMS: {
    backgroundColor: "rgba(70, 70, 70, 0.8)",
    textColor: "#fbbf24",
    borderColor: "rgba(220, 220, 220, 0.5)",
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
export const HOVER_STYLES: Record<string, LabelStyle> = {
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
  DAYDREAMS: {
    backgroundColor: "rgba(90, 90, 90, 0.85)",
  },
  CHEST: {
    backgroundColor: "rgba(245, 158, 11, 0.4)",
  },
};

/**
 * Base configuration shared by all label types
 */
export const BASE_LABEL_CONFIG: LabelConfig = {
  baseClasses: ["rounded-md", "p-0.5", "-translate-x-1/2", "text-xxs", "flex", "items-center", "group", "shadow-md", "font-semibold"],
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
 * Camera view specific configurations
 */
export const CAMERA_VIEW_CONFIGS: Record<number, Partial<LabelConfig>> = {
  1: { // CameraView.Close
    transitions: {
      collapseBehavior: "never",
    },
  },
  2: { // CameraView.Medium
    transitions: {
      collapseBehavior: "delayed",
      collapseDelay: 2000,
    },
  },
  3: { // CameraView.Far
    transitions: {
      collapseBehavior: "immediate",
    },
  },
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
 * Transition class sets for label visibility
 */
export const TRANSITION_CLASSES = {
  EXPANDED: ["max-w-[1000px]", "ml-2", "opacity-100"],
  COLLAPSED: ["max-w-0", "ml-0", "opacity-0"],
};

/**
 * Get the appropriate style based on ownership and state
 */
export function getOwnershipStyle(isMine: boolean, isAlly?: boolean, isDaydreams?: boolean): { default: LabelStyle; hover: LabelStyle } {
  let styleKey = "ENEMY";
  
  if (isDaydreams) {
    styleKey = "DAYDREAMS";
  } else if (isMine) {
    styleKey = "MINE";
  } else if (isAlly) {
    styleKey = "ALLY";
  }

  return {
    default: LABEL_STYLES[styleKey],
    hover: HOVER_STYLES[styleKey],
  };
}

/**
 * Get camera view configuration safely
 */
export function getCameraViewConfig(cameraView: CameraView): Partial<LabelConfig> {
  return CAMERA_VIEW_CONFIGS[cameraView as number] || {};
}

/**
 * Merge multiple label configurations with proper deep merging
 */
export function mergeConfigs(...configs: Partial<LabelConfig>[]): LabelConfig {
  const result: LabelConfig = {
    baseClasses: [],
    transitions: {},
    positionOffset: { x: 0, y: 0, z: 0 },
  };

  for (const config of configs) {
    if (config.baseClasses) {
      result.baseClasses = [...(result.baseClasses || []), ...config.baseClasses];
    }

    if (config.dynamicClasses) {
      result.dynamicClasses = config.dynamicClasses;
    }

    if (config.styles) {
      result.styles = {
        ...result.styles,
        ...config.styles,
      };
    }

    if (config.transitions) {
      result.transitions = {
        ...result.transitions,
        ...config.transitions,
      };
    }

    if (config.positionOffset) {
      result.positionOffset = {
        ...result.positionOffset,
        ...config.positionOffset,
      };
    }

    if (config.renderOrder !== undefined) {
      result.renderOrder = config.renderOrder;
    }

    if (config.updatable !== undefined) {
      result.updatable = config.updatable;
    }
  }

  // Remove duplicate classes
  if (result.baseClasses) {
    result.baseClasses = [...new Set(result.baseClasses)];
  }

  return result;
}