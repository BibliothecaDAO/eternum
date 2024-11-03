type OSWindows =
  | "Leaderboard"
  | "World Structures"
  | "Settings"
  | "Military"
  | "Trade"
  | "Construction"
  | "Assistant"
  | "Quests"
  | "Social"
  | "BattleSimulation";

export interface OSInterface {
  onClick: () => void;
  show: boolean;
  title: string;
  children: React.ReactNode;
  height?: string;
  width?: string;
  hintSection?: string;
}

export const leaderboard: OSWindows = "Leaderboard";
export const worldStructures: OSWindows = "World Structures";
export const settings: OSWindows = "Settings";
export const military: OSWindows = "Military";
export const trade: OSWindows = "Trade";
export const construction: OSWindows = "Construction";
export const quests: OSWindows = "Quests";
export const social: OSWindows = "Social";
export const battleSimulation: OSWindows = "BattleSimulation";
