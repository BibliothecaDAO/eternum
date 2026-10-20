import { usePlayerNames } from "@/hooks/use-player-profile";
import { actNowRefusal, canIssueOrders } from "@/utils/can-issue-orders";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { buildRealmBuilding } from "@/ui/features/settlement/construction/realm-build-actions";
import { getRealmInfo, configManager, resolveUseSimpleCost } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { type BuildingType, type ResourcesIds } from "@bibliothecadao/types";
import { useCallback } from "react";
import { create } from "zustand";
import type { EmpireSuggestion } from "./use-empire-suggestions";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

/** A suggestion this hook runs: every one but a realm's level-up, which is the realm's own step (useRealmLevelUp). */
type OrderSuggestion = EmpireSuggestion & { action: Exclude<EmpireSuggestion["action"], "upgrade"> };

export const isOrderSuggestion = (suggestion: EmpireSuggestion): suggestion is OrderSuggestion =>
  suggestion.action !== "upgrade";

/**
 * The steps being sent, one set for the game: the Build order panel and the suggestions panel offer the same step, and
 * it sends once, whichever of them presses it, until its send ends.
 */
const usePendingSuggestions = create<{ ids: readonly string[] }>(() => ({ ids: [] }));

/** Marks a step as sending; false when it already is. */
const beginPendingSuggestion = (suggestionId: string): boolean => {
  if (usePendingSuggestions.getState().ids.includes(suggestionId)) return false;
  usePendingSuggestions.setState(({ ids }) => ({ ids: [...ids, suggestionId] }));
  return true;
};

const completePendingSuggestion = (suggestionId: string): void =>
  usePendingSuggestions.setState(({ ids }) => ({ ids: ids.filter((id) => id !== suggestionId) }));

/** A step's build submits against its realm without changing the current selection. */
export const useSuggestionActions = () => {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const pendingSuggestionIds = usePendingSuggestions((state) => state.ids);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);

  const names = usePlayerNames();
  const runAutoBuildSuggestion = useCallback(
    async (suggestion: EmpireSuggestion) => {
      const target = resolveAutoBuildTarget(suggestion);
      if (!target) {
        setLeftNavigationView(LeftView.ConstructionView);
        return;
      }

      const entityId = safeInteger(suggestion.realmId);
      if (!Number.isFinite(entityId)) return;

      const realm = getRealmInfo(entityId, setup.store, names.text);
      await buildRealmBuilding({
        entityId,
        realmPosition: realm?.position,
        realm,
        mode,
        target,
        useSimpleCost,
      });
    },
    [mode, setLeftNavigationView, setup.store, useSimpleCost, names],
  );

  const runSuggestionClick = useCallback(
    async (suggestion: OrderSuggestion) => {
      if (!canIssueOrders() || actNowRefusal()) return;
      await runAutoBuildSuggestion(suggestion);
    },
    [runAutoBuildSuggestion],
  );

  const handleSuggestionClick = useCallback(
    async (suggestion: OrderSuggestion) => {
      if (!beginPendingSuggestion(suggestion.id)) return;

      try {
        await runSuggestionClick(suggestion);
      } finally {
        completePendingSuggestion(suggestion.id);
      }
    },
    [runSuggestionClick],
  );

  return { handleSuggestionClick, pendingSuggestionIds };
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
