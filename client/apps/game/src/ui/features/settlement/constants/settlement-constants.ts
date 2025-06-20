import { ResourcesIds } from "@bibliothecadao/types";

// Constants for minimap dimensions and settlement configuration
export const MINIMAP_WIDTH = 2100;
export const MINIMAP_HEIGHT = 1500;
export const SETTLEMENT_BASE_DISTANCE = 30;
export const SETTLEMENT_SUBSEQUENT_DISTANCE = 10;

// Bank icon path
export const BANK_ICON_PATH = `images/resources/${ResourcesIds.Lords}.png`;

// Colors for different states
export const COLORS = {
  ALLY: "#B5BD75", // green
  AVAILABLE: "#776756", // gray-gold
  SELECTED: "#FFF5EA", // lightest
  HOVERED: "#FAFF00", // yellow
  SETTLED: "#FC4C4C", // red
  MINE: "#B5BD75", // green
  EXTRA_PLAYER: "#6B7FD7", // blueish
  BACKGROUND: "#1B1B1B", // gray
  CENTER: "#FFF5EA", // lightest
  BANK: "#8B6914", // even darker gold color for banks
};

// Legend items mapping
export const LEGEND_ITEMS = [
  { color: COLORS.AVAILABLE, label: "Available" },
  { color: COLORS.SELECTED, label: "Selected" },
  { color: COLORS.SETTLED, label: "Settled" },
  { color: COLORS.MINE, label: "Your Realm" },
  { color: COLORS.EXTRA_PLAYER, label: "Your Pending Realms" },
  { color: COLORS.CENTER, label: "Center" },
  { color: COLORS.BANK, label: "Bank" },
];

// Zoom constants
export const MIN_ZOOM_RANGE = 75;
export const MAX_ZOOM_RANGE = 600;
export const MIN_ZOOM_LEVEL = 0.5;
export const MAX_ZOOM_LEVEL = 2;

export const PI = 3.14159265359;
