// Settlement Feature - Settlement management, building, production
// This feature handles all settlement-related functionality

// Settlement Management - Exports used externally
export { MintVillagePassModal } from "./components/mint-village-pass-modal";
export { getUnusedSeasonPasses, queryRealmCount, SeasonPassRealm } from "./components/settle-realm-component";
export { SettlementMinimapModal } from "./components/settlement-minimap-modal";

// Settlement State & Utils - Exports used externally
export * from "./constants";
export * from "./utils";

// Settlement Types & Utils - Exports used externally
export type { SettlementLocation } from "./utils/settlement-types";
export { generateSettlementLocations, getBanksLocations, getOccupiedLocations } from "./utils/settlement-utils";

// Construction System - Exports used externally
export { BuildingInfo, ResourceInfo, SelectPreviewBuildingMenu } from "./construction/select-preview-building";

// Production System - Exports used externally
export { ProductionModal } from "./production/production-modal";
