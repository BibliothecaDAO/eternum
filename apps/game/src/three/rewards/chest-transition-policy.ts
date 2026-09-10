import type { ChestSpatialProjectionChange, GameSyncRuntimeStatus } from "@bibliothecadao/eternum/game-sync";

/** Only live creation/removal may animate. Snapshot/replay and viewport discovery are settled state. */
export function resolveChestTransition(input: {
  change: ChestSpatialProjectionChange;
  syncStatus: GameSyncRuntimeStatus | undefined;
  isVisible: boolean;
  wasVisible: boolean;
}): "summon" | "open" | undefined {
  if (input.syncStatus !== "running") return undefined;
  if (!input.change.previous && input.change.current && input.isVisible) return "summon";
  if (input.change.previous && !input.change.current && input.wasVisible) return "open";
  return undefined;
}
