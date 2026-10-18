import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";

/** Whether an army's carried resources show: always in Eternum, in Blitz only when it carries some. */
export const shouldShowArmyResourceInventoryTab = (resolvedWorldMode: ResolvedGameMode, resourceStackCount: number) =>
  resolvedWorldMode === "eternum" || resourceStackCount > 0;
