// World Feature - Map navigation, exploration, world structures
// This feature handles all world-level interactions and navigation

// World Map Actions - Internal exports removed

// Battles - Exports used externally
export { CombatSimulationPanel } from "./components/battles/combat-simulation-panel";

// Entities - Exports used externally
export { ArmyEntityDetail } from "./components/entities/army-entity-detail";
export { QuestEntityDetail } from "./components/entities/quest-entity-detail";
export { StructureEntityDetail } from "./components/entities/structure-entity-detail";

// Navigation System - Exports used externally
export { CapacityInfo } from "./containers/capacity-info";
export { SecondaryMenuItems } from "./containers/secondary-menu-items";

// World Structures - Exports used externally
export { WorldStructuresMenu } from "./components/world-structures-menu";

// Navigation Config - Exports used externally
export * from "./components/config";
export { ExpandableOSWindow, OSWindow } from "./components/os-window";

// Biome System - Exports used externally
export { BiomeInfoPanel } from "./components/biome-info-panel";

// Hyperstructures - Exports used externally
export { HyperstructureDetails } from "./components/hyperstructures/hyperstructure-details";
export { DisplayedAccess, HyperstructurePanel } from "./components/hyperstructures/hyperstructure-panel";
export { HyperstructureResourceChip } from "./components/hyperstructures/hyperstructure-resource-chip";
export * from "./components/hyperstructures/types";
