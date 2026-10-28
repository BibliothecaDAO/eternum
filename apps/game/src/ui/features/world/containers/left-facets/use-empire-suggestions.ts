import { type IconMeaning } from "@/ui/design-system/icon";

import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView, seasonClockView } from "@/sync/fact-views";

import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentBlockTimestamp, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useActiveBuildOrder, useBuildOrderAccount } from "@/hooks/use-build-orders";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { configManager, TileManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { readBlitzRealmSuggestions, type BlitzSuggestionDraft } from "@bibliothecadao/eternum/automation";
import { buildingMeaning } from "@/ui/design-system/domain-icon-meaning";

export interface EmpireSuggestion extends Omit<BlitzSuggestionDraft, "priority"> {
  icon: IconMeaning;
}

/** Each step's painting: what it builds, its army, or the realm's level-up. */
const suggestionIcon = (draft: BlitzSuggestionDraft): IconMeaning => {
  if (draft.action === "upgrade") return "upgrade";
  if (draft.action === "deploy-army") return "deploy";
  if (draft.buildingTypeHint === undefined) throw new Error(`A build step names no building: ${draft.id}`);
  return buildingMeaning(draft.buildingTypeHint);
};

/** The realms' next steps in the order their kind comes first: a level-up, a hut, the order's buildings, its army. */
const compareSuggestionDrafts = (left: BlitzSuggestionDraft, right: BlitzSuggestionDraft) =>
  left.priority - right.priority;

const resolveBlitzActivity = ({
  resolvedWorldGameMode,
  currentBlockTimestamp,
  gameStartMainAt,
  gameOver,
  devModeOn,
}: {
  resolvedWorldGameMode: string;
  currentBlockTimestamp: number;
  gameStartMainAt?: number | null;
  gameOver: boolean;
  devModeOn: boolean;
}) => {
  const isBlitzWorld = resolvedWorldGameMode === "blitz";
  const isMainPhase = devModeOn || (typeof gameStartMainAt === "number" && currentBlockTimestamp >= gameStartMainAt);
  return isBlitzWorld && isMainPhase && !gameOver;
};

/** A step as the HUD draws it: its painting in place of its rank among the realms' steps. */
export const decorateSuggestion = (draft: BlitzSuggestionDraft): EmpireSuggestion => {
  const { priority, ...suggestion } = draft;
  void priority;

  return {
    ...suggestion,
    icon: suggestionIcon(draft),
  };
};

/**
 * Every realm's next step in a running Blitz (core's buildBlitzRealmSuggestions on the player's active build order, or
 * the default; none while a signed-in account's orders are unread): only a step that can be taken now, a build by the same path the construction window uses.
 */
export const useEmpireSuggestions = (): EmpireSuggestion[] => {
  const {
    setup: { systemCalls },
  } = useGame();
  const mode = useGameModeConfig();
  const facts = useNativeFacts(["Guard", "ResourceBalance", "ResourceProduction", "ResourceWeight"]);
  const resolvedWorldGameMode = useResolvedWorldGameMode();
  // Every surface that shows the steps reads the account's orders: the desktop panel and the phone's Attention alike.
  useBuildOrderAccount();
  const order = useActiveBuildOrder();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const tick = useCurrentDefaultTick();
  const playerStructures = useFactView(playerStructuresView);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const { gameStartMainAt, devModeOn } = useFactView(seasonClockView);
  const metadata = useStructuresWithMetadata({
    structures: playerStructures,
    nameUpdateVersion: structureNameVersion,
  });

  const isBlitzActive = resolveBlitzActivity({
    resolvedWorldGameMode,
    currentBlockTimestamp,
    gameStartMainAt,
    gameOver: configManager.isGameOver(),
    devModeOn,
  });

  return useMemo(() => {
    // An account whose orders are not read yet, or failed to be, follows no order: the panel says why.
    if (!order) return [];
    return metadata
      .flatMap((structure): BlitzSuggestionDraft[] => {
        if (structure.category !== StructureType.Realm) return [];

        return readBlitzRealmSuggestions({
          store: facts.store,
          realmId: structure.entityId,
          realmName: structure.displayName,
          isBlitzActive,
          tiles: TileManager.forStructure(facts.store, systemCalls, structure.entityId),
          mode,
          tick,
          order,
        });
      })
      .toSorted(compareSuggestionDrafts)
      .map(decorateSuggestion);
  }, [metadata, systemCalls, mode, isBlitzActive, facts, tick, order]);
};
