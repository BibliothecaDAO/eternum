import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { configManager, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { useEffect, useMemo, useState } from "react";
import { GameState } from "../types";

export interface UseBlitzGameStateReturn {
  gameState: GameState;
  blitzConfig: ReturnType<typeof configManager.getBlitzConfig>["blitz_registration_config"] | undefined;
  blitzNumHyperStructuresLeft: number | undefined;
  seasonConfig: ReturnType<typeof configManager.getSeasonConfig>;
  seasonEndAt: number | null;
  hasGameEnded: boolean;
  devMode: boolean | undefined;
  registrationCount: number;
  isRegistrationOpen: boolean;
  isGameActive: boolean;
  canMakeHyperstructures: boolean;
}

export function useBlitzGameState(): UseBlitzGameStateReturn {
  const {
    setup: { components },
  } = useDojo();
  const [gameState, setGameState] = useState<GameState>(GameState.NO_GAME);
  const { currentBlockTimestamp } = useBlockTimestamp();

  const worldConfigEntityId = useMemo(() => getEntityIdFromKeys([WORLD_CONFIG_ID]), []);
  const worldConfigValue = useComponentValue(components.WorldConfig, worldConfigEntityId);

  const blitzConfig = configManager.getBlitzConfig()?.blitz_registration_config;
  const blitzNumHyperStructuresLeft = configManager.getBlitzConfig()?.blitz_num_hyperstructures_left;
  const seasonConfig = configManager.getSeasonConfig();
  const seasonEndAt = seasonConfig?.endAt ?? null;
  const devMode = configManager.getDevModeConfig()?.dev_mode_on;

  // Extract primitive values to use as stable dependencies
  const registrationStartAt = blitzConfig?.registration_start_at;
  const registrationEndAt = blitzConfig?.registration_end_at;
  const creationStartAt = blitzConfig?.creation_start_at;
  const creationEndAt = blitzConfig?.creation_end_at;

  const hasGameEnded = useMemo(() => {
    if (!seasonEndAt) return false;
    return currentBlockTimestamp > seasonEndAt;
  }, [currentBlockTimestamp, seasonEndAt]);

  const registrationCount = useMemo(() => {
    const liveCount = worldConfigValue?.blitz_registration_config?.registration_count;
    if (liveCount !== undefined && liveCount !== null) {
      return Number(liveCount);
    }
    return blitzConfig?.registration_count ?? 0;
  }, [blitzConfig?.registration_count, worldConfigValue]);

  // Determine current game state based on time - use primitive deps to avoid infinite loop
  useEffect(() => {
    if (
      registrationStartAt === undefined ||
      registrationEndAt === undefined ||
      creationStartAt === undefined ||
      creationEndAt === undefined
    ) {
      setGameState(GameState.NO_GAME);
      return;
    }

    const hasValidSchedule =
      registrationStartAt > 0 &&
      registrationEndAt > registrationStartAt &&
      creationStartAt > registrationEndAt &&
      creationEndAt >= creationStartAt;

    if (!hasValidSchedule) {
      setGameState(GameState.NO_GAME);
      return;
    }

    const updateGameState = () => {
      const now = Date.now() / 1000;

      if (now >= creationEndAt) {
        setGameState(GameState.NO_GAME);
        return;
      }

      if (now < registrationStartAt) {
        setGameState(GameState.NO_GAME);
        return;
      }

      if (now < registrationEndAt) {
        setGameState(GameState.REGISTRATION);
        return;
      }

      if (now >= creationStartAt) {
        setGameState(GameState.GAME_ACTIVE);
        return;
      }

      setGameState(GameState.NO_GAME);
    };

    updateGameState();
    const interval = setInterval(updateGameState, 1000);
    return () => clearInterval(interval);
  }, [registrationStartAt, registrationEndAt, creationStartAt, creationEndAt]);

  // Derived value - no need for useEffect
  const canMakeHyperstructures = useMemo(() => {
    if (!registrationStartAt) return false;
    const now = Date.now() / 1000;
    return now >= registrationStartAt;
  }, [registrationStartAt]);

  return {
    gameState,
    blitzConfig,
    blitzNumHyperStructuresLeft,
    seasonConfig,
    seasonEndAt,
    hasGameEnded,
    devMode,
    registrationCount,
    isRegistrationOpen: gameState === GameState.REGISTRATION,
    isGameActive: gameState === GameState.GAME_ACTIVE,
    canMakeHyperstructures,
  };
}
