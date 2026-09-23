import { canIssueOrders } from "@/utils/can-issue-orders";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { buildRealmBuilding } from "@/ui/features/settlement/construction/realm-build-actions";
import { ProductionModal } from "@/ui/features/settlement";
import { useRealmActions } from "@/ui/modules/entity-details/hooks/use-realm-actions";
import { getRealmInfo, Position, structureMapPosition } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useQuery } from "@/hooks/helpers/use-query";
import { type BuildingType, type ID, type ResourcesIds } from "@bibliothecadao/types";
import { useCallback, useRef, useState } from "react";
import type { EmpireSuggestion } from "./use-empire-suggestions";

/** Build orders submit against their realm without changing the current selection. */
export const useSuggestionActions = () => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const goToStructure = useGoToStructure(setup);
  const mode = useGameModeConfig();
  const pendingSuggestionIdsRef = useRef(new Set<string>());
  const [pendingSuggestionIds, setPendingSuggestionIds] = useState<string[]>([]);

  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const playerStructures = useFactView(playerStructuresView);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = mode.id !== "blitz" && requestedSimpleCost;

  const { fireUpgrade, pendingRealmId } = useRealmActions();

  const focusRealm = useCallback(
    async (realmId: ID, forceMap = false) => {
      const target = playerStructures.find((structure) => structure.entityId === realmId);
      if (target?.structure) {
        const position = structureMapPosition(setup.store, target.structure);
        setSelectedHex({ col: position.x, row: position.y });
        await goToStructure(realmId, Position.fromContract(position), forceMap || isMapView);
      } else {
        setStructureEntityId(realmId);
      }
    },
    [goToStructure, isMapView, playerStructures, setSelectedHex, setStructureEntityId],
  );

  const runAutoBuildSuggestion = useCallback(
    async (suggestion: EmpireSuggestion) => {
      const target = resolveAutoBuildTarget(suggestion);
      if (!target) {
        setLeftNavigationView(LeftView.ConstructionView);
        return;
      }

      const entityId = Number(suggestion.realmId);
      if (!Number.isFinite(entityId)) return;

      const realm = getRealmInfo(entityId, setup.store);
      await buildRealmBuilding({
        entityId,
        realmPosition: realm?.position,
        realm,
        mode,
        target,
        useSimpleCost,
      });
    },
    [mode, setLeftNavigationView, setup.store, useSimpleCost],
  );

  const runSuggestionClick = useCallback(
    async (suggestion: EmpireSuggestion) => {
      if (!canIssueOrders()) return;

      switch (suggestion.action) {
        case "upgrade":
          await fireUpgrade(suggestion.realmId);
          return;
        case "deploy-explorer":
          await focusRealm(suggestion.realmId, true);
          if (!canIssueOrders()) return;
          usePopoverStore.getState().close();
          useUIStore.getState().setSuggestedArmyDeploymentStructureId(Number(suggestion.realmId));
          return;
        case "garrison":
          await focusRealm(suggestion.realmId);
          if (!canIssueOrders()) return;
          setLeftNavigationView(LeftView.MilitaryView);
          return;
        case "build-wheat":
        case "build-wood":
        case "build-coal":
        case "build-copper":
        case "build-military":
        case "build-market":
        case "build-worker-hut":
          await runAutoBuildSuggestion(suggestion);
          return;
        case "build-first":
        case "expand-population":
          await focusRealm(suggestion.realmId);
          if (!canIssueOrders()) return;
          setLeftNavigationView(LeftView.ConstructionView);
          return;
        default:
          openSurface({
            id: "production",
            content: <ProductionModal preSelectedRealmId={Number(suggestion.realmId)} />,
          });
      }
    },
    [fireUpgrade, focusRealm, runAutoBuildSuggestion, setLeftNavigationView, openSurface],
  );

  const beginPendingSuggestion = useCallback((suggestionId: string) => {
    if (pendingSuggestionIdsRef.current.has(suggestionId)) return false;

    const next = new Set(pendingSuggestionIdsRef.current);
    next.add(suggestionId);
    pendingSuggestionIdsRef.current = next;
    setPendingSuggestionIds(Array.from(next));
    return true;
  }, []);

  const completePendingSuggestion = useCallback((suggestionId: string) => {
    if (!pendingSuggestionIdsRef.current.has(suggestionId)) return;

    const next = new Set(pendingSuggestionIdsRef.current);
    next.delete(suggestionId);
    pendingSuggestionIdsRef.current = next;
    setPendingSuggestionIds(Array.from(next));
  }, []);

  const handleSuggestionClick = useCallback(
    async (suggestion: EmpireSuggestion) => {
      if (!beginPendingSuggestion(suggestion.id)) return;

      try {
        await runSuggestionClick(suggestion);
      } finally {
        completePendingSuggestion(suggestion.id);
      }
    },
    [beginPendingSuggestion, completePendingSuggestion, runSuggestionClick],
  );

  return { handleSuggestionClick, pendingRealmId, pendingSuggestionIds };
};

const resolveAutoBuildTarget = (
  suggestion: EmpireSuggestion,
): { type: BuildingType; resource?: ResourcesIds } | null => {
  if (!suggestion.buildingTypeHint) return null;

  return {
    type: suggestion.buildingTypeHint,
    resource: suggestion.resourceHint,
  };
};
