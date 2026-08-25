import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { buildRealmBuilding } from "@/ui/features/settlement/construction/realm-build-actions";
import { ProductionModal } from "@/ui/features/settlement";
import { useRealmActions } from "@/ui/modules/entity-details/hooks/use-realm-actions";
import { getRealmInfo, Position } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { type BuildingType, type ID, type ResourcesIds } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useCallback, useRef, useState } from "react";
import type { EmpireSuggestion } from "./use-empire-suggestions";
import { gameEntityKey } from "@/dojo/game-scope";

/**
 * Resolves a suggestion click into the right side-effect: focus the target
 * realm (camera + active-structure state) and either fire a multicall directly
 * or open the relevant modal. Extracted so the in-rail panel (removed) and the
 * top-header SuggestionsPill can share one path.
 */
export const useSuggestionActions = () => {
  const { account, setup } = useDojo();
  const { isMapView } = useQuery();
  const goToStructure = useGoToStructure(setup);
  const mode = useGameModeConfig();
  const pendingSuggestionIdsRef = useRef(new Set<string>());
  const [pendingSuggestionIds, setPendingSuggestionIds] = useState<string[]>([]);

  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);

  const { fireUpgrade, fireProvision, fireUpgradeAndProvision, pendingRealmId } = useRealmActions();

  const focusRealm = useCallback(
    async (realmId: ID) => {
      const target = playerStructures.find((structure) => structure.entityId === realmId);
      const coords = target?.structure?.base;
      if (coords && coords.coord_x !== undefined && coords.coord_y !== undefined) {
        const col = Number(coords.coord_x);
        const row = Number(coords.coord_y);
        if (Number.isFinite(col) && Number.isFinite(row)) {
          setSelectedHex({ col, row });
        }
        await goToStructure(realmId, new Position({ x: coords.coord_x, y: coords.coord_y }), isMapView);
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

      const realm = getRealmInfo(gameEntityKey([BigInt(entityId)]), setup.components);
      await buildRealmBuilding({
        entityId,
        realmPosition: realm?.position,
        realm,
        mode,
        target,
        useSimpleCost,
        world: {
          account: account.account,
          components: setup.components,
          systemCalls: setup.systemCalls,
        },
        onBuildSuccess: setSelectedBuildingHex,
      });
    },
    [
      account.account,
      mode,
      setLeftNavigationView,
      setSelectedBuildingHex,
      setup.components,
      setup.systemCalls,
      useSimpleCost,
    ],
  );

  const runSuggestionClick = useCallback(
    async (suggestion: EmpireSuggestion) => {
      await focusRealm(suggestion.realmId);

      switch (suggestion.action) {
        case "upgrade-and-provision":
          await fireUpgradeAndProvision(suggestion.realmId);
          return;
        case "upgrade":
          await fireUpgrade(suggestion.realmId);
          return;
        case "provision":
          await fireProvision(suggestion.realmId);
          return;
        case "garrison":
        case "deploy-explorer":
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
          setLeftNavigationView(LeftView.ConstructionView);
          return;
        default:
          toggleModal(<ProductionModal preSelectedRealmId={Number(suggestion.realmId)} />);
      }
    },
    [
      fireProvision,
      fireUpgrade,
      fireUpgradeAndProvision,
      focusRealm,
      runAutoBuildSuggestion,
      setLeftNavigationView,
      toggleModal,
    ],
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
