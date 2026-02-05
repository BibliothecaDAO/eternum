import { applyWorldSelection } from "@/runtime/world";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { useAccount } from "@starknet-react/core";
import { useCallback, useState } from "react";
import { HeroTitle } from "../components/hero-title";
import { GameCardGrid, type WorldSelection } from "../components/game-selector/game-card-grid";
import type { Chain } from "@contracts";
import { env } from "../../../../../env";

// URL for entering game
const GAME_MAP_URL = "/play/map?col=0&row=0";
const SPECTATE_MAP_URL = "/play/map?col=0&row=0&spectate=true";

interface PlayViewProps {
  className?: string;
}

/**
 * Main play view - shows card-based game selector for Mainnet and Slot.
 * This is the default landing page content.
 */
export const PlayView = ({ className }: PlayViewProps) => {
  const [isEntering, setIsEntering] = useState(false);

  // Auth state
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const setModal = useUIStore((state) => state.setModal);

  const handleSelectGame = useCallback(
    async (selection: WorldSelection) => {
      const hasAccount = Boolean(account) || isConnected;

      console.log("[PlayView] handleSelectGame:", selection.name, "hasAccount:", hasAccount);
      setIsEntering(true);

      try {
        const { chainChanged } = await applyWorldSelection(selection, env.VITE_PUBLIC_CHAIN as Chain);
        console.log("[PlayView] World selected, chainChanged:", chainChanged);

        // If chain changed, need to reload - go directly to map
        if (chainChanged) {
          window.location.href = GAME_MAP_URL;
          return;
        }

        // Check if user needs to sign in before entering game
        if (!hasAccount) {
          setModal(<SignInPromptModal />, true);
          setIsEntering(false);
          return;
        }

        // Navigate directly to map view
        console.log("[PlayView] Navigating to game map...");
        window.location.href = GAME_MAP_URL;
      } catch (error) {
        console.error("Failed to select game:", error);
        setIsEntering(false);
      }
    },
    [account, isConnected, setModal],
  );

  const handleSpectate = useCallback(async (selection: WorldSelection) => {
    console.log("[PlayView] handleSpectate:", selection.name);
    setIsEntering(true);

    try {
      const { chainChanged } = await applyWorldSelection(selection, env.VITE_PUBLIC_CHAIN as Chain);
      console.log("[PlayView] World selected for spectate, chainChanged:", chainChanged);

      if (chainChanged) {
        window.location.href = SPECTATE_MAP_URL;
        return;
      }

      // Navigate directly to map view for spectating (with spectate param)
      console.log("[PlayView] Navigating to spectate...");
      window.location.href = SPECTATE_MAP_URL;
    } catch (error) {
      console.error("Failed to spectate game:", error);
      setIsEntering(false);
    }
  }, []);

  const handleRegister = useCallback(
    async (selection: WorldSelection) => {
      const hasAccount = Boolean(account) || isConnected;
      console.log("[PlayView] handleRegister:", selection.name, "hasAccount:", hasAccount);

      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      setIsEntering(true);

      try {
        const { chainChanged } = await applyWorldSelection(selection, env.VITE_PUBLIC_CHAIN as Chain);
        console.log("[PlayView] World selected for registration, chainChanged:", chainChanged);

        if (chainChanged) {
          // Go to play route which will show registration flow
          window.location.href = "/play";
          return;
        }

        // Navigate to play route for registration (onboarding flow will handle it)
        console.log("[PlayView] Navigating to registration flow...");
        window.location.href = "/play";
      } catch (error) {
        console.error("Failed to register for game:", error);
        setIsEntering(false);
      }
    },
    [account, isConnected, setModal],
  );

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Hero title */}
      <div className="mb-2">
        <HeroTitle />
      </div>

      {/* Game grids */}
      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", isEntering && "opacity-50 pointer-events-none")}>
        {/* Mainnet Games */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg border border-brilliance/20 p-4">
          <GameCardGrid
            chain="mainnet"
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onRegister={handleRegister}
          />
        </div>

        {/* Slot Games */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg border border-gold/20 p-4">
          <GameCardGrid
            chain="slot"
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onRegister={handleRegister}
          />
        </div>
      </div>
    </div>
  );
};
