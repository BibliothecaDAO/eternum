import { useGameSelector as useGameSelectorHook } from "@/hooks/helpers/use-game-selector";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { useAccount } from "@starknet-react/core";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameInfo } from "../components/game-selector/game-card";
import { GameCarousel } from "../components/game-selector/game-carousel";
import { HeroTitle } from "../components/hero-title";
import { useLandingContext } from "../context/landing-context";
import { useWorldGames } from "../hooks/use-world-games";

interface PlayViewProps {
  /** Override games for testing/demo purposes */
  games?: GameInfo[];
  className?: string;
}

/**
 * Main play view - shows the game selector carousel with hero title.
 * This is the default landing page content.
 */
export const PlayView = ({ games: overrideGames, className }: PlayViewProps) => {
  const navigate = useNavigate();
  const [isEntering, setIsEntering] = useState(false);

  // Get background change function from context
  const { setBackgroundId } = useLandingContext();

  // Get real games from world profiles
  const { games: worldGames, isLoading: isLoadingGames, refresh: refreshGames } = useWorldGames();

  // Use existing game selector hook for world selection
  const { selectGame } = useGameSelectorHook();

  // Auth state
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const setModal = useUIStore((state) => state.setModal);

  // Use override games if provided, otherwise use real games
  const games = overrideGames ?? worldGames;

  const handleEnter = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (selectedGame: GameInfo) => {
      const hasAccount = Boolean(account) || isConnected;

      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      setIsEntering(true);

      try {
        // The game.id is the world name, navigate to play
        // The existing game route will handle loading the world
        navigate("/play");
      } finally {
        setIsEntering(false);
      }
    },
    [account, isConnected, navigate, setModal],
  );

  const handleJoin = useCallback(async () => {
    setIsEntering(true);

    try {
      // Open world selector to pick/create a world
      await selectGame({ navigateAfter: true, navigateTo: "/play" });
      // Refresh games list after selection
      refreshGames();
    } catch {
      // User cancelled
    } finally {
      setIsEntering(false);
    }
  }, [selectGame, refreshGames]);

  const handleGameChange = useCallback(
    (game: GameInfo) => {
      // Update background when switching between games in carousel
      setBackgroundId(game.backgroundId);
    },
    [setBackgroundId],
  );

  return (
    <div className={cn("flex min-h-[calc(100vh-12rem)] flex-col justify-center", className)}>
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-20">
        {/* Left side - Hero title */}
        <div className="flex-1">
          <HeroTitle />
        </div>

        {/* Right side - Game selector */}
        <div className="flex justify-center lg:justify-end">
          <GameCarousel
            games={games}
            onEnterGame={handleEnter}
            onJoinSeason={handleJoin}
            onGameChange={handleGameChange}
            isLoading={isEntering || isLoadingGames}
          />
        </div>
      </div>
    </div>
  );
};

// Demo data for development/testing
export const DEMO_GAMES: GameInfo[] = [
  {
    id: "blitz-s3-1",
    name: "Blitz Season 3",
    realmName: "Ironhold",
    status: "active",
    lords: 12345,
    troops: 8,
    rank: 42,
    backgroundId: "01",
  },
  {
    id: "blitz-s3-2",
    name: "Blitz Season 3",
    realmName: "Shadowmere",
    status: "active",
    lords: 8721,
    troops: 5,
    rank: 89,
    backgroundId: "03",
  },
  {
    id: "blitz-s2",
    name: "Blitz Season 2",
    realmName: "Sunforge",
    status: "ended",
    lords: 45000,
    troops: 0,
    rank: 15,
    backgroundId: "06",
  },
];
