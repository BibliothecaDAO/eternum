export type OSWindows =
  | "Event Log"
  | "Banks"
  | "Leaderboard"
  | "Hyperstructures"
  | "Structures"
  | "Settings"
  | "Resources"
  | "Military"
  | "Entity Details"
  | "Trade"
  | "Construction"
  | "Assistant"
  | "Create Offer"
  | "Accept Offer"
  | "Quests";

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
export const structures: OSWindows = "Structures";
export const settings: OSWindows = "Settings";
export const resources: OSWindows = "Resources";
export const military: OSWindows = "Military";
export const entityDetails: OSWindows = "Entity Details";
export const trade: OSWindows = "Trade";
export const construction: OSWindows = "Construction";
export const assistant: OSWindows = "Assistant";
export const createOffer: OSWindows = "Create Offer";
export const acceptOfferTitle: OSWindows = "Accept Offer";
export const quests: OSWindows = "Quests";
