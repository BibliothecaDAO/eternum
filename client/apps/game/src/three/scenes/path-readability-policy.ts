import type { PathDisplayState } from "../types/path";

export type PathReadabilityView = "close" | "medium" | "far";

const MEDIUM_AND_FAR_OPACITY_FLOORS: Record<PathDisplayState, number> = {
  selected: 0.8,
  hover: 0.5,
  moving: 0.7,
  preview: 0.45,
};

const BASE_PATH_OPACITY: Record<PathDisplayState, number> = {
  selected: 0.8,
  hover: 0.4,
  moving: 0.6,
  preview: 0.3,
};

export function resolvePathReadabilityPolicy(input: {
  displayState: PathDisplayState;
  view: PathReadabilityView;
}): {
  endpointEmphasis: boolean;
  opacity: number;
} {
  const baseOpacity = BASE_PATH_OPACITY[input.displayState];
  const opacity =
    input.view === "close" ? baseOpacity : Math.max(baseOpacity, MEDIUM_AND_FAR_OPACITY_FLOORS[input.displayState]);

  return {
    endpointEmphasis: input.displayState !== "hover",
    opacity,
  };
}
