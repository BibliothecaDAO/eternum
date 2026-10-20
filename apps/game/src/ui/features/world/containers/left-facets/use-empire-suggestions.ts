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

/** Each step's painting: what it builds, or the realm's level-up. */
const ACTION_ICONS: Record<EmpireSuggestionAction, IconMeaning> = {
  "build-copper": "copper",
  "build-coal": "coal",
  "build-military": "barracks",
  "build-wheat": "farm",
  "build-wood": "wood",
  "build-worker-hut": "workers-hut",
  upgrade: "upgrade",
};

/** The realms' next steps in the order their kind comes first: a level-up, a hut, then the order's buildings. */
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

const decorateSuggestion = (draft: BlitzSuggestionDraft): EmpireSuggestion => {
  const { priority, ...suggestion } = draft;
  void priority;

  return {
    ...suggestion,
    icon: ACTION_ICONS[draft.action],
  };
};

/**
 * Every realm's next step in a running Blitz (core's buildBlitzRealmSuggestions on the default build order): only a
 * step that can be submitted now, by the same build path the construction window uses.
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
