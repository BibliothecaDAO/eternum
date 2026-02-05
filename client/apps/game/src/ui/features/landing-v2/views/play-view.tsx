import { applyWorldSelection } from "@/runtime/world";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { useAccount } from "@starknet-react/core";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeroTitle } from "../components/hero-title";
import { InlineGameSelector, type WorldSelection } from "../components/game-selector/inline-game-selector";
import type { Chain } from "@contracts";
import { env } from "../../../../../env";

interface PlayViewProps {
  className?: string;
}

/**
 * Main play view - shows the game selector inline with hero title.
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

  return (
    <div className={cn("flex min-h-[calc(100vh-12rem)] flex-col justify-center", className)}>
      <div className="flex flex-col gap-8">
        {/* Hero title */}
        <div className="mb-4">
          <HeroTitle />
        </div>

        {/* Inline game selector */}
        <div className={cn("transition-opacity", isEntering && "opacity-50 pointer-events-none")}>
          <InlineGameSelector onSelectGame={handleSelectGame} />
        </div>
      </div>
    </div>
  );
};
