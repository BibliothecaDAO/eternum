import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { useAccount } from "@starknet-react/core";
import { useCallback, useState } from "react";
import { HeroTitle } from "../components/hero-title";
import { UnifiedGameGrid, type WorldSelection } from "../components/game-selector/game-card-grid";
import { GameEntryModal } from "../components/game-entry-modal";
import type { Chain } from "@contracts";

interface PlayViewProps {
  className?: string;
}

/**
 * Main play view - shows card-based game selector for Mainnet and Slot.
 * This is the default landing page content.
 */
export const PlayView = ({ className }: PlayViewProps) => {
  // Modal state for game entry
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<WorldSelection | null>(null);
  const [isSpectateMode, setIsSpectateMode] = useState(false);

  // Auth state
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const setModal = useUIStore((state) => state.setModal);

  const handleSelectGame = useCallback(
    (selection: WorldSelection) => {
      const hasAccount = Boolean(account) || isConnected;

      console.log("[PlayView] handleSelectGame:", selection.name, "hasAccount:", hasAccount);

      // Check if user needs to sign in before entering game
      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      // Open game entry modal
      setSelectedWorld(selection);
      setIsSpectateMode(false);
      setEntryModalOpen(true);
    },
    [account, isConnected, setModal],
  );

  const handleSpectate = useCallback((selection: WorldSelection) => {
    console.log("[PlayView] handleSpectate:", selection.name);

    // Open game entry modal in spectate mode (no account required)
    setSelectedWorld(selection);
    setIsSpectateMode(true);
    setEntryModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setEntryModalOpen(false);
    setSelectedWorld(null);
  }, []);

  // Registration is handled inline by GameCardGrid - this callback is for any post-registration actions
  const handleRegistrationComplete = useCallback(() => {
    console.log("[PlayView] Registration completed");
    // The toast is already shown by the GameCard component
  }, []);

  return (
    <>
      <div className={cn("flex flex-col gap-6", className)}>
        {/* Hero title */}
        <div className="mb-2">
          <HeroTitle />
        </div>

        {/* Unified Game Grid */}
        <div
          className={cn(
            "bg-black/30 backdrop-blur-sm rounded-lg border border-gold/20 p-4",
            entryModalOpen && "opacity-50 pointer-events-none",
          )}
        >
          <UnifiedGameGrid
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onRegistrationComplete={handleRegistrationComplete}
          />
        </div>
      </div>

      {/* Game Entry Modal - Loading + Settlement */}
      {selectedWorld && selectedWorld.chain && (
        <GameEntryModal
          isOpen={entryModalOpen}
          onClose={handleCloseModal}
          worldName={selectedWorld.name}
          chain={selectedWorld.chain}
          isSpectateMode={isSpectateMode}
        />
      )}
    </>
  );
};
