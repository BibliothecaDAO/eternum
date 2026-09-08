import { useEffect, useRef, useState } from "react";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { getBuildingCosts, getRealmInfo, type TileManager } from "@bibliothecadao/eternum";
import {
  BuildingType,
  BuildingTypeToString,
  ContractAddress,
  ResourcesIds,
  type HexPosition,
} from "@bibliothecadao/types";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { buildingEntityKey, gameEntityKey } from "@/sync/game-scope";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { resolveConstructionBuildability } from "./construction-buildability";
import { getConstructionBuildingGroups } from "./construction-groups";

export interface PlotConstructionTarget {
  entityId: number;
  spot: HexPosition;
  tileManager: TileManager;
  isCurrentTarget: () => boolean;
}

export function usePlotConstruction(target: PlotConstructionTarget) {
  const {
    setup: { components },
    account: { account },
  } = useDojo();
  const mode = useGameModeConfig();
  const ordersAllowed = useUIStore(canIssueOrders);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setUseSimpleCost = useUIStore((state) => state.setUseSimpleCost);
  useCurrentDefaultTick();
  const entity = gameEntityKey([BigInt(target.entityId)]);
  useComponentValue(components.Structure, entity);
  useComponentValue(components.StructureBuildings, entity);
  useComponentValue(components.Resource, entity);
  const outer = target.tileManager.getHexCoords();
  useComponentValue(components.Building, buildingEntityKey(outer.col, outer.row, target.spot.col, target.spot.row));
  const realm = getRealmInfo(entity, components);
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
      components,
      realm,
      mode,
      targetSpot: target.spot,
      tileManager: target.tileManager,
    });
  const groups = getConstructionBuildingGroups(mode, realm?.resources ?? []).map((group) => ({
    label: group.label,
    buildings: group.buildings.map((type) => {
      const state = buildability(type);
      const costs = getBuildingCosts(target.entityId, components, type, useSimpleCost);
      return {
        type,
        label: BuildingTypeToString[type],
        cost:
          costs?.map((cost) => `${cost.amount.toLocaleString()} ${ResourcesIds[cost.resource]}`).join(" · ") ??
          "Cost unavailable",
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
      // Keep TileManager and the observed system call's existing pending building lifecycle.
      await target.tileManager.placeBuilding(account, target.entityId, type, target.spot, useSimpleCost);
      usePopoverStore.getState().close("plot-construction");
    } catch (reason) {
      console.error("[Plot construction] placement failed", reason);
      setError("Building could not be placed. Try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return { groups, build, error, useSimpleCost, setUseSimpleCost, visible: ordersAllowed && isOwner };
}
