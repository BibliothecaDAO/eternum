import type { GameIcon } from "@/ui/design-system/atoms/game-icon";
import {
  ArrowUpCircle,
  Building2,
  Compass,
  Home as HomeIcon,
  Shield,
  Sparkles,
  Wheat,
} from "@/ui/design-system/atoms/game-icons";
import { hasGameEnded } from "@bibliothecadao/eternum/game-sync";
import { useGameModeConfig, useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { TileManager } from "@bibliothecadao/eternum";
import { useGame, useNativeRevision } from "@bibliothecadao/react";
import { StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import {
  readBlitzRealmSuggestions,
  type BlitzSuggestionDraft,
  type EmpireSuggestionAction,
} from "@bibliothecadao/eternum/automation";

export interface EmpireSuggestion extends Omit<BlitzSuggestionDraft, "priority"> {
  icon: GameIcon;
}

const ACTION_ICONS: Record<EmpireSuggestionAction, GameIcon> = {
  "build-copper": Building2,
  "build-coal": Building2,
  "build-first": Building2,
  "build-military": Shield,
  "build-market": Building2,
  "build-wheat": Wheat,
  "build-wood": Building2,
  "build-worker-hut": HomeIcon,
  "deploy-explorer": Compass,
  "expand-population": Sparkles,
  garrison: Shield,
  upgrade: ArrowUpCircle,
};

const compareSuggestionDrafts = (left: BlitzSuggestionDraft, right: BlitzSuggestionDraft) => {
  if (left.emphasis !== right.emphasis) return left.emphasis === "primary" ? -1 : 1;
  return left.priority - right.priority;
};

const resolveBlitzActivity = ({
  resolvedWorldGameMode,
  currentBlockTimestamp,
  gameStartMainAt,
  gameEndAt,
  devModeOn,
}: {
  resolvedWorldGameMode: string;
  currentBlockTimestamp: number;
  gameStartMainAt?: number | null;
  gameEndAt?: number | null;
  devModeOn: boolean;
}) => {
  const isBlitzWorld = resolvedWorldGameMode === "blitz";
  const isMainPhase = devModeOn || (typeof gameStartMainAt === "number" && currentBlockTimestamp >= gameStartMainAt);
  const isSeasonOver = hasGameEnded("Live", gameEndAt ?? 0, currentBlockTimestamp);

  return isBlitzWorld && isMainPhase && !isSeasonOver;
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
  const playerStructures = useUIStore((state) => state.playerStructures);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const gameStartMainAt = useUIStore((state) => state.gameStartMainAt);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const devModeOn = useUIStore((state) => state.devModeOn);
  const metadata = useStructuresWithMetadata({
    structures: playerStructures,
    store,
    nameUpdateVersion: structureNameVersion,
  });

  const isBlitzActive = resolveBlitzActivity({
    resolvedWorldGameMode,
    currentBlockTimestamp,
    gameStartMainAt,
    gameEndAt,
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
