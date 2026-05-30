import { HintSection } from "@/ui/features/progression/hints/hint-modal";

type OSWindows =
  | "Hyperstructures"
  | "Settings"
  | "Military"
  | "Trade"
  | "Construction"
  | "Assistant"
  | "Quests"
  | "Leaderboard"
  | "Rewards"
  | "Shortcuts"
  | "LatestFeatures"
  | "Transactions"
  | "ExplorationAutomation"
  | "ProductionAutomation";

export interface OSInterface {
  onClick: () => void;
  show: boolean;
  title: string;
  children: React.ReactNode;
  height?: string;
  width?: string;
  hintSection?: HintSection;
  className?: string;
  /** Optional pixel cap for the popup body's auto-grow max-height. */
  maxHeightCap?: number;
}

export interface ExpandableOSInterface extends OSInterface {
  childrenExpanded?: React.ReactNode;
  widthExpanded?: string;
  isExpanded?: boolean;
}

const hyperstructures: OSWindows = "Hyperstructures";
export const settings: OSWindows = "Settings";
export const leaderboard: OSWindows = "Leaderboard";
export const rewards: OSWindows = "Rewards";
export const shortcuts: OSWindows = "Shortcuts";
export const latestFeatures: OSWindows = "LatestFeatures";
export const transactions: OSWindows = "Transactions";
export const explorationAutomation: OSWindows = "ExplorationAutomation";
export const productionAutomation: OSWindows = "ProductionAutomation";
