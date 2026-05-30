// Popup-name keys used with the UI store's isPopupOpen/togglePopup helpers.
type PopupName =
  | "Settings"
  | "Leaderboard"
  | "Rewards"
  | "Shortcuts"
  | "LatestFeatures"
  | "Transactions"
  | "ExplorationAutomation"
  | "ProductionAutomation";

export const settings: PopupName = "Settings";
export const leaderboard: PopupName = "Leaderboard";
export const rewards: PopupName = "Rewards";
export const shortcuts: PopupName = "Shortcuts";
export const latestFeatures: PopupName = "LatestFeatures";
export const transactions: PopupName = "Transactions";
export const explorationAutomation: PopupName = "ExplorationAutomation";
export const productionAutomation: PopupName = "ProductionAutomation";
