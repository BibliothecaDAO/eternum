// Settlement Feature - Settlement management, building, production
// This feature handles all settlement-related functionality

// Settlement State & Utils - Exports used externally
export * from "./constants";
export * from "./utils";

// Settlement Types & Utils - Exports used externally
export type { SettlementLocation } from "./utils/settlement-types";
export { generateSettlementLocations, getBanksLocations, getOccupiedLocations } from "./utils/settlement-utils";

// Construction System - Exports used externally
export { SelectPreviewBuildingMenu } from "./construction/select-preview-building";

// Production System - Exports used externally
export { ProductionModal } from "./production/production-modal";
