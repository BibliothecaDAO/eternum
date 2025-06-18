// Military Feature - Army management, combat, defense, raids
// This feature consolidates all military operations from components and modules

// Army Management Components
export { ArmyChip } from "./components/army-chip";
export { ArmyList } from "./components/army-list";
export { ArmyManagementCard } from "./components/army-management-card";
export { EntitiesArmyTable } from "./components/entities-army-table";
export { TroopChip } from "./components/troop-chip";

// Defense Components
export { CompactDefenseDisplay } from "./components/compact-defense-display";
export { StructureDefence } from "./components/structure-defence";

// Battle System
export { AttackContainer } from "./battle/attack-container";
export { CombatContainer } from "./battle/combat-container";
export { CombatModal } from "./battle/combat-modal";
export { RaidContainer } from "./battle/raid-container";
export { RaidResult } from "./battle/raid-result";

// Transfer & Support
export { HelpContainer } from "./components/help-container";
export { HelpModal } from "./components/help-modal";
export { TransferResourcesContainer } from "./components/transfer-resources-container";
export { TransferTroopsContainer } from "./components/transfer-troops-container";

// Events & Logs
export { BattleLogsTable } from "./components/battle-logs-table";

// Main Military Module
export { Military } from "./military";

// Utils
export * from "./battle/combat-utils";
