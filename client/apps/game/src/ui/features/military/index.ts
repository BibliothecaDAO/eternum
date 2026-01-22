// Military Feature - Army management, combat, defense, raids
// This feature consolidates all military operations from components and modules

// Defense Components - Used externally
export { CompactDefenseDisplay } from "./components/compact-defense-display";


// Chest System
export { ChestModal } from "./chest/chest-modal";

// Transfer & Support
export { HelpModal } from "./components/help-modal";

// Main Military Module - Used across the application
export { Military } from "./military";

// Utils - Used by other features
export { formatBiomeBonus, formatTypeAndBonuses, getStaminaDisplay } from "./battle/combat-utils";

// Army Components
export { CooldownTimer, type DefenseTroop } from "./components/structure-defence";
export { TroopChip } from "./components/troop-chip";
