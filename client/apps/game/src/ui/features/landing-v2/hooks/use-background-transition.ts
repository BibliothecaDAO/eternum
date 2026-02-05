import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";

// Default backgrounds per route
const ROUTE_BACKGROUNDS: Record<string, string> = {
  "/": "01",
  "/profile": "05",
  "/markets": "04",
  "/leaderboard": "07",
};

/**
 * Hook for managing background transitions.
 * Supports both route-based and game-based background changes.
 */
export const useBackgroundTransition = (initialBackground?: string) => {
  const location = useLocation();

  // Get default background for current route
  const routeBackground = ROUTE_BACKGROUNDS[location.pathname] ?? "01";

  // Override background (e.g., when selecting a different game)
  const [overrideBackground, setOverrideBackground] = useState<string | null>(null);

  // Current active background
  const currentBackground = overrideBackground ?? initialBackground ?? routeBackground;

  const setBackground = useCallback((backgroundId: string) => {
    setOverrideBackground(backgroundId);
  }, []);

  const resetBackground = useCallback(() => {
    setOverrideBackground(null);
  }, []);

  return {
    currentBackground,
    setBackground,
    resetBackground,
    routeBackground,
  };
};
