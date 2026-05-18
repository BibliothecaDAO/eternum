import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";

export const ARMY_RESOURCE_INVENTORY_TAB_LABEL = "Inventory";

export const shouldShowArmyResourceInventoryTab = (resolvedWorldMode: ResolvedGameMode, resourceStackCount: number) =>
  resolvedWorldMode === "eternum" || resourceStackCount > 0;
