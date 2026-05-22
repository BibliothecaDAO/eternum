import { playerColorManager, PlayerColorProfile } from "../../systems/player-colors";
import type { CameraView } from "../../scenes/camera-view";
import { resolveCameraView } from "./label-view";
import { LabelConfig, LabelStyle } from "./label-types";

/**
 * Predefined label styles for different ownership states
 */
export const LABEL_STYLES: Record<string, LabelStyle> = {
  MINE: {
    backgroundColor: "rgba(15, 31, 22, 0.88)",
    textColor: "#d9f99d",
    borderColor: "rgba(132, 204, 22, 0.72)",
  },
  ALLY: {
    backgroundColor: "rgba(15, 27, 49, 0.88)",
    textColor: "#bae6fd",
    borderColor: "rgba(56, 189, 248, 0.68)",
  },
  ENEMY: {
    backgroundColor: "rgba(45, 21, 24, 0.9)",
    textColor: "#fecdd3",
    borderColor: "rgba(248, 113, 113, 0.68)",
  },
  NEUTRAL: {
    backgroundColor: "rgba(24, 27, 31, 0.88)",
    textColor: "#e5e7eb",
    borderColor: "rgba(156, 163, 175, 0.62)",
  },
  DAYDREAMS: {
    backgroundColor: "rgba(28, 24, 35, 0.9)",
    textColor: "#fbbf24",
    borderColor: "rgba(244, 215, 130, 0.68)",
  },
  CHEST: {
    backgroundColor: "rgba(50, 36, 14, 0.9)",
    textColor: "#fbbf24",
    borderColor: "rgba(245, 158, 11, 0.72)",
  },
};

/**
 * Hover styles that correspond to base styles
 */
export const HOVER_STYLES: Record<string, LabelStyle> = {
  MINE: {
    backgroundColor: "rgba(18, 44, 28, 0.94)",
  },
  ALLY: {
    backgroundColor: "rgba(20, 42, 74, 0.94)",
  },
  ENEMY: {
    backgroundColor: "rgba(64, 25, 30, 0.94)",
  },
  NEUTRAL: {
    backgroundColor: "rgba(32, 36, 42, 0.94)",
  },
  DAYDREAMS: {
    backgroundColor: "rgba(39, 33, 49, 0.94)",
  },
  CHEST: {
    backgroundColor: "rgba(63, 44, 16, 0.94)",
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
 * Camera view specific configurations
 */
const CAMERA_VIEW_CONFIGS: Record<number, Partial<LabelConfig>> = {
  1: {
    // CameraView.Close
    transitions: {
      collapseBehavior: "never",
    },
  },
  2: {
    // CameraView.Medium
    transitions: {
      collapseBehavior: "delayed",
      collapseDelay: 2000,
    },
  },
  3: {
    // CameraView.Far
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
const TRANSITION_CLASSES = {
  EXPANDED: ["max-w-[1000px]", "ml-2", "opacity-100"],
  COLLAPSED: ["max-w-0", "ml-0", "opacity-0"],
};

/**
 * Get the appropriate style based on ownership and state
 */
export function getOwnershipStyle(isMine: boolean, isDaydreams?: boolean): { default: LabelStyle; hover: LabelStyle } {
  let styleKey = "ENEMY";

  if (isDaydreams) {
    styleKey = "DAYDREAMS";
  } else if (isMine) {
    styleKey = "MINE";
  }

  return {
    default: LABEL_STYLES[styleKey],
    hover: HOVER_STYLES[styleKey],
  };
}

/**
 * Get player-specific ownership style that uses unique colors for each enemy player
 * This provides visual distinction between different enemy players on the battlefield
 *
 * @param isMine - Is this the current player's unit/structure?
 * @param isAlly - Is this an ally's unit/structure?
 * @param isDaydreams - Is this an AI agent?
 * @param ownerAddress - Owner's wallet address for enemy color assignment
 */
function getPlayerOwnershipStyle(
  isMine: boolean,
  isAlly: boolean,
  isDaydreams: boolean,
  ownerAddress?: bigint | string,
): { default: LabelStyle; hover: LabelStyle; profile: PlayerColorProfile } {
  const profile = playerColorManager.getProfileForUnit(isMine, isAlly, isDaydreams, ownerAddress);

  // For self, ally, and agent - use predefined styles
  if (isMine || isAlly || isDaydreams) {
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
      profile,
    };
  }

  // For enemies - use player-specific colors from the color profile
  const defaultStyle: LabelStyle = {
    backgroundColor: profile.backgroundColor,
    textColor: profile.textColor,
    borderColor: profile.borderColor,
  };

  // Create a slightly brighter hover version
  const hoverStyle: LabelStyle = {
    backgroundColor: profile.backgroundColor.replace("0.3", "0.4"),
  };

  return {
    default: defaultStyle,
    hover: hoverStyle,
    profile,
  };
}

/**
 * Get camera view configuration safely
 */
function getCameraViewConfig(cameraView: CameraView): Partial<LabelConfig> {
  const effectiveView = resolveCameraView(cameraView);
  return CAMERA_VIEW_CONFIGS[effectiveView as number] || {};
}

/**
 * Merge multiple label configurations with proper deep merging
 */
function mergeConfigs(...configs: Partial<LabelConfig>[]): LabelConfig {
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
