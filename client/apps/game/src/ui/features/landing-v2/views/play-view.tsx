import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { useAccount } from "@starknet-react/core";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HeroTitle } from "../components/hero-title";
import { UnifiedGameGrid, type WorldSelection } from "../components/game-selector/game-card-grid";
import { GameEntryModal } from "../components/game-entry-modal";

interface PlayViewProps {
  className?: string;
}

type PlayTab = "play" | "learn" | "lore";

/**
 * Learn tab content - placeholder for now
 */
const LearnContent = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-8 backdrop-blur-xl">
    <h2 className="mb-4 font-serif text-2xl text-gold">Learn to Play</h2>
    <p className="text-gold/70 mb-6">Master the art of realm conquest with our comprehensive guides and tutorials.</p>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-lg border border-gold/10 bg-black/40 p-4">
        <h3 className="text-lg font-semibold text-gold mb-2">Getting Started</h3>
        <p className="text-sm text-gold/60">Learn the basics of settling realms and managing resources.</p>
      </div>
      <div className="rounded-lg border border-gold/10 bg-black/40 p-4">
        <h3 className="text-lg font-semibold text-gold mb-2">Combat Guide</h3>
        <p className="text-sm text-gold/60">Master the combat system and conquer your enemies.</p>
      </div>
      <div className="rounded-lg border border-gold/10 bg-black/40 p-4">
        <h3 className="text-lg font-semibold text-gold mb-2">Economy & Trading</h3>
        <p className="text-sm text-gold/60">Understand resource management and marketplace strategies.</p>
      </div>
    </div>
  </div>
);

/**
 * Lore tab content - placeholder for now
 */
const LoreContent = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-8 backdrop-blur-xl">
    <h2 className="mb-4 font-serif text-2xl text-gold">The Lore of Realms</h2>
    <p className="text-gold/70 mb-6">Discover the rich history and mythology of the Realms universe.</p>
    <div className="prose prose-invert max-w-none">
      <p className="text-gold/60">
        In the beginning, there were 8,000 Realms scattered across the known world. Each Realm, unique in its resources
        and strategic position, became the foundation of great empires and fierce rivalries.
      </p>
      <p className="text-gold/60 mt-4">
        The Orders emerged as the organizing forces of civilization - from the Order of Power to the Order of Giants,
        each bringing their own philosophy and approach to realm governance.
      </p>
      <p className="text-gold/60 mt-4">
        Now, in the age of Blitz, lords from across the land compete in rapid cycles of conquest, each battle lasting
        but two hours, yet echoing through eternity...
      </p>
    </div>
  </div>
);

/**
 * Main play view - shows card-based game selector for Mainnet and Slot.
 * This is the default landing page content.
 */
export const PlayView = ({ className }: PlayViewProps) => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as PlayTab) || "play";

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

  const renderContent = () => {
    switch (activeTab) {
      case "learn":
        return <LearnContent />;
      case "lore":
        return <LoreContent />;
      case "play":
      default:
        return (
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
        );
    }
  };

  return (
    <>
      <div className={cn("flex flex-col gap-6", className)}>
        {/* Hero title - only show on Play tab */}
        {activeTab === "play" && (
          <div className="mb-2">
            <HeroTitle />
          </div>
        )}

        {/* Tab content */}
        {renderContent()}
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
