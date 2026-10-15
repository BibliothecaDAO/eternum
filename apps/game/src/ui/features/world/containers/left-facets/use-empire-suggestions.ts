import { type IconMeaning } from "@/ui/design-system/icon";

import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView, seasonClockView } from "@/sync/fact-views";

import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { configManager, TileManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import {
  readBlitzRealmSuggestions,
  type BlitzSuggestionDraft,
  type EmpireSuggestionAction,
} from "@bibliothecadao/eternum/automation";

export interface EmpireSuggestion extends Omit<BlitzSuggestionDraft, "priority"> {
  icon: IconMeaning;
}

const ACTION_ICONS: Record<EmpireSuggestionAction, IconMeaning> = {
  "build-copper": "realm" as const,
  "build-coal": "realm" as const,
  "build-first": "realm" as const,
  "build-military": "defend" as const,
  "build-market": "realm" as const,
  "build-wheat": "wheat" as const,
  "build-wood": "realm" as const,
  "build-worker-hut": "home" as const,
  "deploy-explorer": "map" as const,
  "expand-population": "relics" as const,
  garrison: "defend" as const,
  upgrade: "arrow-up" as const,
};

const compareSuggestionDrafts = (left: BlitzSuggestionDraft, right: BlitzSuggestionDraft) => {
  if (left.emphasis !== right.emphasis) return left.emphasis === "primary" ? -1 : 1;
  return left.priority - right.priority;
};

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

const decorateSuggestion = (draft: BlitzSuggestionDraft): EmpireSuggestion => {
  const { priority, ...suggestion } = draft;
  void priority;

  return {
    ...suggestion,
    icon: ACTION_ICONS[draft.action],
  };
};

/**
 * Aggregates per-realm suggestions across the current empire. Blitz suggestions
 * are intentionally affordability-aware and only expose build actions that can
 * be submitted by the same autobuild path used in the construction UI.
 */
export const useEmpireSuggestions = (): EmpireSuggestion[] => {
  const {
    setup: { store, systemCalls },
  } = useGame();
  const mode = useGameModeConfig();
  const revision = useNativeRevision(["Guard", "ResourceBalance", "ResourceProduction", "ResourceWeight"]);
  const resolvedWorldGameMode = useResolvedWorldGameMode();
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const playerStructures = useFactView(playerStructuresView);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const { gameStartMainAt, devModeOn } = useFactView(seasonClockView);
  const metadata = useStructuresWithMetadata({
    structures: playerStructures,
    store,
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
    return metadata
      .flatMap((structure): BlitzSuggestionDraft[] => {
        if (structure.category !== StructureType.Realm) return [];

        return readBlitzRealmSuggestions({
          store,
          realmId: structure.entityId,
          realmName: structure.displayName,
          isBlitzActive,
          tiles: TileManager.forStructure(store, systemCalls, structure.entityId),
          mode,
        });
      })
      .toSorted(compareSuggestionDrafts)
      .map(decorateSuggestion);
  }, [metadata, store, systemCalls, mode, isBlitzActive, revision, currentBlockTimestamp]);
};
