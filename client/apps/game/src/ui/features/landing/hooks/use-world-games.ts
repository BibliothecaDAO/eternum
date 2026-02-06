import { getActiveWorld, getActiveWorldName, getWorldProfiles } from "@/runtime/world/store";
import type { WorldProfile } from "@/runtime/world/types";
import { useEffect, useState } from "react";
import type { GameInfo } from "../components/game-selector/game-card";

// Map background IDs based on world index for variety
const BACKGROUND_IDS = ["01", "02", "03", "04", "05", "06", "07", "08"];

const getBackgroundForIndex = (index: number): string => {
  return BACKGROUND_IDS[index % BACKGROUND_IDS.length];
};

/**
 * Converts a WorldProfile to a GameInfo for display in the game selector.
 */
const worldProfileToGameInfo = (profile: WorldProfile, index: number): GameInfo => {
  // Determine status based on some heuristic (for now, all stored worlds are "active")
  const status: GameInfo["status"] = "active";

  return {
    id: profile.name,
    name: profile.name,
    realmName: undefined, // Will be populated when we have realm data
    status,
    lords: undefined,
    troops: undefined,
    rank: undefined,
    backgroundId: getBackgroundForIndex(index),
  };
};

interface UseWorldGamesResult {
  games: GameInfo[];
  activeGame: GameInfo | null;
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Hook to get available games/worlds from the stored world profiles.
 * Returns them as GameInfo objects for the game selector.
 */
const useWorldGames = (): UseWorldGamesResult => {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [activeGame, setActiveGame] = useState<GameInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadGames = () => {
    setIsLoading(true);

    try {
      const profiles = getWorldProfiles();
      const activeWorldName = getActiveWorldName();
      const activeWorld = getActiveWorld();

      // Convert profiles to GameInfo array
      const gameInfos = Object.values(profiles).map((profile, index) => worldProfileToGameInfo(profile, index));

      setGames(gameInfos);

      // Set active game
      if (activeWorld) {
        const activeIndex = gameInfos.findIndex((g) => g.id === activeWorldName);
        if (activeIndex >= 0) {
          setActiveGame(gameInfos[activeIndex]);
        } else {
          setActiveGame(null);
        }
      } else {
        setActiveGame(null);
      }
    } catch (error) {
      console.error("Failed to load world games:", error);
      setGames([]);
      setActiveGame(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();

    // Listen for storage changes (in case world is selected in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "WORLD_PROFILES" || e.key === "ACTIVE_WORLD_NAME") {
        loadGames();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return {
    games,
    activeGame,
    isLoading,
    refresh: loadGames,
  };
};
