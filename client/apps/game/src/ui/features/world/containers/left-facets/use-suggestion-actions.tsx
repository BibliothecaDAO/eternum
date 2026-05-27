import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { ProductionModal } from "@/ui/features/settlement";
import { useRealmActions } from "@/ui/modules/entity-details/hooks/use-realm-actions";
import { Position } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import { useCallback } from "react";
import type { EmpireSuggestion } from "./use-empire-suggestions";

/**
 * Resolves a suggestion click into the right side-effect: focus the target
 * realm (camera + active-structure state) and either fire a multicall directly
 * or open the relevant modal. Extracted so the in-rail panel (removed) and the
 * top-header SuggestionsPill can share one path.
 */
export const useSuggestionActions = () => {
  const { setup } = useDojo();
  const { isMapView } = useQuery();
  const goToStructure = useGoToStructure(setup);

  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const { fireUpgrade, fireProvision, fireUpgradeAndProvision, pendingRealmId } = useRealmActions();

  const focusRealm = useCallback(
    (realmId: ID) => {
      const target = playerStructures.find((structure) => structure.entityId === realmId);
      const coords = target?.structure?.base;
      if (coords && coords.coord_x !== undefined && coords.coord_y !== undefined) {
        const col = Number(coords.coord_x);
        const row = Number(coords.coord_y);
        if (Number.isFinite(col) && Number.isFinite(row)) {
          setSelectedHex({ col, row });
        }
        void goToStructure(realmId, new Position({ x: coords.coord_x, y: coords.coord_y }), isMapView);
      } else {
        setStructureEntityId(realmId);
      }
    },
    [goToStructure, isMapView, playerStructures, setSelectedHex, setStructureEntityId],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: EmpireSuggestion) => {
      focusRealm(suggestion.realmId);

      switch (suggestion.action) {
        case "upgrade-and-provision":
          void fireUpgradeAndProvision(suggestion.realmId);
          return;
        case "upgrade":
          void fireUpgrade(suggestion.realmId);
          return;
        case "provision":
          void fireProvision(suggestion.realmId);
          return;
        case "garrison":
          setLeftNavigationView(LeftView.MilitaryView);
          return;
        case "build-wheat":
        case "build-wood":
        case "build-coal":
        case "build-copper":
        case "build-worker-hut":
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
      setLeftNavigationView,
      toggleModal,
    ],
  );

  return { handleSuggestionClick, pendingRealmId };
};
