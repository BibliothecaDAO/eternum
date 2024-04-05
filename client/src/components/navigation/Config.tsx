export type OSWindows =
  | "Event Log"
  | "Banks"
  | "Leaderboard"
  | "Hyperstructures"
  | "Settings"
  | "Resources"
  | "Military";

export interface OSInterface {
  onClick: () => void;
  show: boolean;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const eventLog: OSWindows = "Event Log";
export const banks: OSWindows = "Banks";
export const leaderboard: OSWindows = "Leaderboard";
export const hyperstructures: OSWindows = "Hyperstructures";
export const settings: OSWindows = "Settings";
export const resources: OSWindows = "Resources";
export const military: OSWindows = "Military";
