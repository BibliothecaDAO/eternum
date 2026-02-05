import { applyWorldSelection } from "@/runtime/world";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { useAccount } from "@starknet-react/core";
import { useCallback, useState } from "react";
import { HeroTitle } from "../components/hero-title";
import { UnifiedGameGrid, type WorldSelection } from "../components/game-selector/game-card-grid";
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

  // Registration is handled inline by GameCardGrid - this callback is for any post-registration actions
  const handleRegistrationComplete = useCallback(() => {
    console.log("[PlayView] Registration completed");
    // The toast is already shown by the GameCard component
  }, []);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Hero title */}
      <div className="mb-2">
        <HeroTitle />
      </div>

      {/* Unified Game Grid */}
      <div
        className={cn(
          "bg-black/30 backdrop-blur-sm rounded-lg border border-gold/20 p-4",
          isEntering && "opacity-50 pointer-events-none",
        )}
      >
        <UnifiedGameGrid
          onSelectGame={handleSelectGame}
          onSpectate={handleSpectate}
          onRegistrationComplete={handleRegistrationComplete}
        />
      </div>
    </div>
  );
};
