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
import { BuildingType, BuildingTypeToString, type HexPosition } from "@bibliothecadao/types";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { plotKey, sendBuilding } from "./send-building";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import { getConstructionBuildingGroups, resolveBuildingRequirements } from "./construction-groups";
import { getPlayerName } from "@/services/identity/player-profiles";
import { useAccountAddress } from "@/hooks/store/use-account-store";

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
  useNativeRevision([
    "Structure",
    "StructureBuildings",
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "ProductionBonus",
    "Building",
  ]);
  const realm = getRealmInfo(target.entityId, store, getPlayerName);
  const isOwner = isViewerOwner(realm?.owner, viewer);
  const [error, setError] = useState<string | null>(null);
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
  const groups = getConstructionBuildingGroups(mode, realm?.resources ?? []).map((group) => ({
    label: group.label,
    buildings: group.buildings.map((type) => {
      const state = buildability(type);
      return {
        type,
        label: BuildingTypeToString[type],
        requirements: resolveBuildingRequirements(target.entityId, store, type, useSimpleCost, currentDefaultTick),
        reason: state.reason,
        disabled: !state.canSubmit || pending,
      };
    }),
  }));
  const build = async (type: BuildingType) => {
    if (!canIssueOrders() || !isOwner || !target.isCurrentTarget() || pending) return;
    const state = buildability(type);
    if (!state.canSubmit) {
      setError(state.reason ?? "Building cannot be submitted.");
      return;
    }
    try {
      await sendBuilding({
        realmId: target.entityId,
        type,
        plot: target.spot,
        useSimpleCost,
        onSent: () => usePopoverStore.getState().close("plot-construction"),
      });
    } catch (reason) {
      console.error("[Plot construction] placement failed", reason);
      setError("Building could not be placed. Try again.");
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
