import { useEffect, useRef, useState } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import {
  type BuildingTiles,
  boardBonusesFor,
  configManager,
  describeBoardBonus,
  getRealmInfo,
  resolveUseSimpleCost,
} from "@bibliothecadao/eternum";
import {
  BuildingType,
  BuildingTypeToString,
  ContractAddress,
  getNeighborHexes,
  type HexPosition,
} from "@bibliothecadao/types";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import { getConstructionBuildingGroups, resolveBuildingRequirements } from "./construction-groups";
import { getPlayerName } from "@/services/identity/player-profiles";

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
  const boardRules = store.get("BoardRules", { game_id: configManager.getActiveGameId() });
  const neighbourCategories = getNeighborHexes(target.spot.col, target.spot.row).map(
    (hex) =>
      target.tileManager.existingBuildings().find((built) => built.col === hex.col && built.row === hex.row)?.category,
  );
  const neighbourHints = (type: BuildingType) =>
    boardBonusesFor(boardRules, type).map((bonus) => ({
      label: `Beside ${BuildingTypeToString[bonus.neighbour as BuildingType] ?? "a neighbour"}: ${describeBoardBonus(bonus)}`,
      present: neighbourCategories.includes(bonus.neighbour),
    }));
  const isOwner = Boolean(account?.address && realm?.owner === ContractAddress(account.address));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  useEffect(() => setError(null), [target.spot.col, target.spot.row, useSimpleCost]);
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
        neighbourHints: neighbourHints(type),
        reason: state.reason,
        disabled: !state.canSubmit || pending,
      };
    }),
  }));
  const build = async (type: BuildingType) => {
    if (!canIssueOrders() || !isOwner || !target.isCurrentTarget() || submitting.current) return;
    const state = buildability(type);
    if (!state.canSubmit) {
      setError(state.reason ?? "Building cannot be submitted.");
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      await requireActiveGameClient().actions.placeBuilding({
        structureId: target.entityId,
        buildingType: type,
        hex: target.spot,
        useSimpleCost,
      });
      usePopoverStore.getState().close("plot-construction");
    } catch (reason) {
      console.error("[Plot construction] placement failed", reason);
      setError("Building could not be placed. Try again.");
    } finally {
      submitting.current = false;
      setPending(false);
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
