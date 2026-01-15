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
  | "BattleSimulation"
  | "Rewards"
  | "Shortcuts"
  | "LatestFeatures"
  | "Transactions";

export interface OSInterface {
  onClick: () => void;
  show: boolean;
  title: string;
  children: React.ReactNode;
  height?: string;
  width?: string;
  hintSection?: HintSection;
  className?: string;
}

export interface ExpandableOSInterface extends OSInterface {
  childrenExpanded?: React.ReactNode;
  widthExpanded?: string;
  isExpanded?: boolean;
}

export const hyperstructures: OSWindows = "Hyperstructures";
export const settings: OSWindows = "Settings";
export const military: OSWindows = "Military";
export const trade: OSWindows = "Trade";
export const construction: OSWindows = "Construction";
export const leaderboard: OSWindows = "Leaderboard";
export const rewards: OSWindows = "Rewards";
export const battleSimulation: OSWindows = "BattleSimulation";
export const shortcuts: OSWindows = "Shortcuts";
export const latestFeatures: OSWindows = "LatestFeatures";
export const transactions: OSWindows = "Transactions";
