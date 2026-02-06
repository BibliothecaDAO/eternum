import { useCallback, useState } from "react";
import type { GameInfo } from "../components/game-selector/game-card";

interface UseGameSelectorOptions {
  onBackgroundChange?: (backgroundId: string) => void;
}

/**
 * Hook for managing game selection state.
 * Handles the carousel state and background transitions.
 */
const useGameSelector = ({ onBackgroundChange }: UseGameSelectorOptions = {}) => {
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [isEntering, setIsEntering] = useState(false);

  const handleGameChange = useCallback(
    (game: GameInfo) => {
      setSelectedGame(game);
      onBackgroundChange?.(game.backgroundId);
    },
    [onBackgroundChange],
  );

  const handleEnterGame = useCallback(async (game: GameInfo) => {
    setIsEntering(true);
    setSelectedGame(game);

    // Simulate transition delay - in real implementation this would trigger navigation
    // The actual navigation will be handled by the parent component
    await new Promise((resolve) => setTimeout(resolve, 500));

    setIsEntering(false);
    return game;
  }, []);

  const handleJoinSeason = useCallback(async () => {
    setIsEntering(true);
    // This will trigger the onboarding flow
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsEntering(false);
  }, []);

  return {
    selectedGame,
    isEntering,
    handleGameChange,
    handleEnterGame,
    handleJoinSeason,
  };
};
