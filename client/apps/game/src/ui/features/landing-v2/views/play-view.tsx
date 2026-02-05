import { applyWorldSelection } from "@/runtime/world";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { useAccount } from "@starknet-react/core";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeroTitle } from "../components/hero-title";
import { HexGameMap, type WorldSelection } from "../components/game-selector/hex-game-map";
import type { Chain } from "@contracts";
import { env } from "../../../../../env";

interface PlayViewProps {
  className?: string;
}

/**
 * Main play view - shows hex-based game maps for Mainnet and Slot.
 * This is the default landing page content.
 */
export const PlayView = ({ className }: PlayViewProps) => {
  const navigate = useNavigate();
  const [isEntering, setIsEntering] = useState(false);

  // Auth state
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const setModal = useUIStore((state) => state.setModal);

  const handleSelectGame = useCallback(
    async (selection: WorldSelection) => {
      const hasAccount = Boolean(account) || isConnected;

      setIsEntering(true);

      try {
        const { chainChanged } = await applyWorldSelection(selection, env.VITE_PUBLIC_CHAIN as Chain);

        // If chain changed, need to reload
        if (chainChanged) {
          window.location.href = "/play";
          return;
        }

        // Check if user needs to sign in before entering game
        if (!hasAccount) {
          setModal(<SignInPromptModal />, true);
          return;
        }

        // Navigate to game
        navigate("/play");
      } catch (error) {
        console.error("Failed to select game:", error);
      } finally {
        setIsEntering(false);
      }
    },
    [account, isConnected, navigate, setModal],
  );

  const handleSpectate = useCallback(
    async (selection: WorldSelection) => {
      setIsEntering(true);

      try {
        const { chainChanged } = await applyWorldSelection(selection, env.VITE_PUBLIC_CHAIN as Chain);

        if (chainChanged) {
          window.location.href = "/play";
          return;
        }

        // Navigate to game in spectate mode
        navigate("/play");
      } catch (error) {
        console.error("Failed to spectate game:", error);
      } finally {
        setIsEntering(false);
      }
    },
    [navigate],
  );

  const handleRegister = useCallback(
    async (selection: WorldSelection) => {
      const hasAccount = Boolean(account) || isConnected;

      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      setIsEntering(true);

      try {
        const { chainChanged } = await applyWorldSelection(selection, env.VITE_PUBLIC_CHAIN as Chain);

        if (chainChanged) {
          window.location.href = "/play";
          return;
        }

        // Navigate to game for registration
        navigate("/play");
      } catch (error) {
        console.error("Failed to register for game:", error);
      } finally {
        setIsEntering(false);
      }
    },
    [account, isConnected, navigate, setModal],
  );

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {/* Hero title */}
      <div className="mb-4">
        <HeroTitle />
      </div>

      {/* Game maps */}
      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8", isEntering && "opacity-50 pointer-events-none")}>
        {/* Mainnet Map */}
        <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-brilliance/20 p-6">
          <HexGameMap
            chain="mainnet"
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onRegister={handleRegister}
          />
        </div>

        {/* Slot Map */}
        <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gold/20 p-6">
          <HexGameMap
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
