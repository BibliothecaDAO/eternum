import { HintSection } from "../hints/HintModal";

type OSWindows =
  | "World Structures"
  | "Settings"
  | "Military"
  | "Trade"
  | "Construction"
  | "Assistant"
  | "Quests"
  | "Social"
  | "BattleSimulation"
  | "PillageSimulation"
  | "Rewards";

export interface OSInterface {
  onClick: () => void;
  show: boolean;
  title: string;
  children: React.ReactNode;
  height?: string;
  width?: string;
  hintSection?: HintSection;
}

export interface ExpandableOSInterface extends OSInterface {
  childrenExpanded?: React.ReactNode;
  widthExpanded?: string;
  isExpanded?: boolean;
}

export const worldStructures: OSWindows = "World Structures";
export const settings: OSWindows = "Settings";
export const military: OSWindows = "Military";
export const trade: OSWindows = "Trade";
export const construction: OSWindows = "Construction";
export const social: OSWindows = "Social";
export const rewards: OSWindows = "Rewards";
export const battleSimulation: OSWindows = "BattleSimulation";
export const pillageSimulation: OSWindows = "PillageSimulation";
