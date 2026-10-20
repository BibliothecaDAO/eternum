import { usePlayerNames } from "@/hooks/use-player-profile";
import { useEffect, useState } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import {
  type BuildingTiles,
  configManager,
  getRealmInfo,
  resolveUseSimpleCost,
  isViewerOwner,
} from "@bibliothecadao/eternum";
import { BuildingType, buildingName, type HexPosition } from "@bibliothecadao/types";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { plotKey, sendBuilding, useStillShowing } from "./send-building";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import { describeBuildingGives } from "./building-gives";
import { getConstructionBuildingGroups, resolveBuildingRequirements } from "./construction-groups";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { type ActionFailure, actionFailure } from "@/ui/features/event-feed/notify";

export interface PlotConstructionTarget {
  entityId: number;
  spot: HexPosition;
  tileManager: BuildingTiles;
  isCurrentTarget: () => boolean;
}

export function usePlotConstruction(target: PlotConstructionTarget) {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const viewer = useAccountAddress();
  const mode = useGameModeConfig();
  const ordersAllowed = useUIStore(canIssueOrders);
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);
  const setUseSimpleCost = useUIStore((state) => state.setUseSimpleCost);
  const currentDefaultTick = useCurrentDefaultTick();
  const stillShowing = useStillShowing(target.spot);
  useNativeRevision([
    "Structure",
    "StructureBuildings",
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "ProductionBonus",
    "Building",
  ]);
  const names = usePlayerNames();
  const realm = getRealmInfo(target.entityId, store, names.text);
  const isOwner = isViewerOwner(realm?.owner, viewer);
  // Why the last build did not happen: told until the next build, or another plot or cost.
  const [error, setError] = useState<ActionFailure | null>(null);
  // The plot's building in flight, sent from here or any other surface: one at a time until its outcome.
  const pending = useInFlight("plot", plotKey(target.entityId, target.spot)) !== undefined;
  useEffect(() => {
    setError(null);
  }, [target.spot.col, target.spot.row, useSimpleCost]);
  const buildability = (buildingType: BuildingType) =>
    resolveConstructionBuildability({
      entityId: target.entityId,
      buildingType,
      useSimpleCost,
      store,
      realm,
      mode,
      targetSpot: target.spot,
      tileManager: target.tileManager,
    });
  const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: target.entityId });
  // Each group keeps the game's own order and its fixed grid: nothing is re-sorted by what can rise now.
  const groups = getConstructionBuildingGroups(mode, realm?.resources ?? []).map((group) => ({
    label: group.label,
    grid: group.grid,
    buildings: group.buildings.map((type) => {
      const state = buildability(type);
      return {
        type,
        label: buildingName(type, mode.id === "frontier"),
        requirements: resolveBuildingRequirements(target.entityId, store, type, useSimpleCost, currentDefaultTick),
        gives:
          structure &&
          describeBuildingGives(store, structure, type, configManager.getBuildingCategoryConfig(type).capacity_grant),
        reason: state.reason,
        disabled: !state.canSubmit || pending,
      };
    }),
  }));
  const build = async (type: BuildingType) => {
    if (!canIssueOrders() || !isOwner || !target.isCurrentTarget() || pending) return;
    const state = buildability(type);
    if (!state.canSubmit) {
      setError({ refused: false, reason: state.reason ?? "Building cannot be submitted." });
      return;
    }
    setError(null);
    try {
      await sendBuilding({
        realmId: target.entityId,
        type,
        plot: target.spot,
        useSimpleCost,
        from: {
          isOpen: () => target.isCurrentTarget() && stillShowing(),
          close: () => usePopoverStore.getState().close("plot-construction"),
        },
      });
    } catch (failure) {
      setError(actionFailure(failure, "Building could not be placed. Try again."));
    }
  };
  return {
    groups,
    build,
    error,
    allowSimpleCost: configManager.buildingCostMode === "choice",
    useSimpleCost,
    setUseSimpleCost,
    visible: ordersAllowed && isOwner,
  };
}
