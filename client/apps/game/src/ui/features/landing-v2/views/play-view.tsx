import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { latestFeatures, type FeatureType } from "@/ui/features/world/latest-features";
import { useAccount } from "@starknet-react/core";
import {
  BookOpen,
  ExternalLink,
  Play,
  Sparkles,
  Video,
  Newspaper,
  Wrench,
  TrendingUp,
  Bug,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  History,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HeroTitle } from "../components/hero-title";
import { UnifiedGameGrid, type WorldSelection } from "../components/game-selector/game-card-grid";
import { GameEntryModal } from "../components/game-entry-modal";
import { ScoreCardModal } from "../components/score-card-modal";

interface PlayViewProps {
  className?: string;
}

type PlayTab = "play" | "learn" | "news";

// Video guide data - ordered from basic to advanced
const VIDEO_GUIDES = [
  {
    title: "Getting Started Tutorial",
    url: "https://x.com/lordcumberlord/status/1986947491640598776",
    author: "@lordcumberlord",
  },
  {
    title: "Resource Management Guide",
    url: "https://x.com/lordcumberlord/status/1990719396113707225",
    author: "@lordcumberlord",
  },
  {
    title: "Advanced Combat Tactics",
    url: "https://x.com/lordcumberlord/status/2011095751196360980",
    author: "@lordcumberlord",
  },
];

// Written guide data - ordered from basic to advanced
const WRITTEN_GUIDES = [
  {
    title: "Blitz Key Concepts",
    url: "https://docs.realms.world/blitz/key-concepts",
    source: "Official Docs",
  },
  {
    title: "How to Build Your Legacy",
    url: "https://legacygg.substack.com/p/how-to-build-your-legacy-in-realms",
    source: "Legacy GG",
  },
  {
    title: "Complete Guide (English)",
    url: "https://docs.google.com/document/d/e/2PACX-1vQch9CAmt9zXc7bwFuvdCOWz0x9IzLbZlgvOMX96xV7lWza1d3dLMHpaWaDa6eAo5rasaC4KtpPpGuP/pub",
    source: "nexonik & tsuaurym",
    lang: "EN",
  },
  {
    title: "Guia Completo (Portuguese)",
    url: "https://docs.google.com/document/d/e/2PACX-1vQlOxLQ5snLk23-2rsla4tPh8I5ijNaecYl1r_Dgk-9-An42Sos4HVl2EQGr0P1avW-W94qIwM4QrJn/pub",
    source: "nexonik & tsuaurym",
    lang: "PT",
  },
];

/**
 * Learn tab content - Video Guides, Written Guides, and Practice Games in 3 columns
 */
const LearnContent = ({
  onSelectGame,
  onSpectate,
  onRegistrationComplete,
}: {
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onRegistrationComplete: () => void;
}) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    {/* Video Guides */}
    <div className="flex flex-col rounded-2xl border border-gold/20 bg-black/60 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20">
          <Video className="h-4 w-4 text-red-400" />
        </div>
        <div>
          <h2 className="font-serif text-lg text-gold">Video Guides</h2>
          <p className="text-xs text-gold/60">Learn from the best</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {VIDEO_GUIDES.map((video) => (
          <a
            key={video.url}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-lg border border-gold/10 bg-black/40 p-3 transition-all hover:border-gold/30 hover:bg-black/50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 transition-colors group-hover:bg-red-500/20 flex-shrink-0">
              <Play className="h-4 w-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold text-gold truncate group-hover:text-gold/80">{video.title}</h3>
              <p className="text-[10px] text-gold/50">{video.author}</p>
            </div>
            <ExternalLink className="h-3 w-3 text-gold/30 group-hover:text-gold/60 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>

    {/* Written Guides */}
    <div className="flex flex-col rounded-2xl border border-gold/20 bg-black/60 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
          <BookOpen className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h2 className="font-serif text-lg text-gold">Written Guides</h2>
          <p className="text-xs text-gold/60">Documentation & tutorials</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {WRITTEN_GUIDES.map((guide) => (
          <a
            key={guide.url}
            href={guide.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-lg border border-gold/10 bg-black/40 p-3 transition-all hover:border-gold/30 hover:bg-black/50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 transition-colors group-hover:bg-blue-500/20 flex-shrink-0">
              <BookOpen className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold text-gold truncate group-hover:text-gold/80">{guide.title}</h3>
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-gold/50">{guide.source}</p>
                {guide.lang && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-gold/10 text-gold/70">{guide.lang}</span>
                )}
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-gold/30 group-hover:text-gold/60 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>

    {/* Practice Games (Dev Mode) */}
    <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-black/60 p-4 backdrop-blur-xl min-h-0">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
          <Wrench className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <h2 className="font-serif text-lg text-gold">Practice Games</h2>
          <p className="text-xs text-gold/60">Dev mode - join anytime!</p>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <UnifiedGameGrid
          onSelectGame={onSelectGame}
          onSpectate={onSpectate}
          onRegistrationComplete={onRegistrationComplete}
          devModeFilter={true}
          title="Practice"
        />
      </div>
    </div>
  </div>
);

/**
 * Get icon and color for feature type
 */
const getFeatureTypeStyle = (type: FeatureType) => {
  switch (type) {
    case "feature":
      return { icon: Sparkles, color: "text-emerald-400", bg: "bg-emerald-500/20", label: "New Feature" };
    case "improvement":
      return { icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/20", label: "Improvement" };
    case "balance":
      return { icon: Wrench, color: "text-amber-400", bg: "bg-amber-500/20", label: "Balance" };
    case "fix":
      return { icon: Bug, color: "text-red-400", bg: "bg-red-500/20", label: "Bug Fix" };
    default:
      return { icon: Sparkles, color: "text-gold", bg: "bg-gold/20", label: "Update" };
  }
};

/**
 * News tab content - Latest features and updates
 */
const NewsContent = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-6 backdrop-blur-xl">
    <div className="flex items-center gap-3 mb-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20">
        <Newspaper className="h-5 w-5 text-gold" />
      </div>
      <div>
        <h2 className="font-serif text-xl text-gold">Latest Updates</h2>
        <p className="text-sm text-gold/60">Recent features, improvements, and changes</p>
      </div>
    </div>

    <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
      {latestFeatures.map((feature, index) => {
        const style = getFeatureTypeStyle(feature.type);
        const Icon = style.icon;

        return (
          <div
            key={`${feature.date}-${index}`}
            className="group rounded-lg border border-gold/10 bg-black/40 p-4 transition-all hover:border-gold/20"
          >
            <div className="flex items-start gap-3">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", style.bg)}>
                <Icon className={cn("h-4 w-4", style.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-gold">{feature.title}</h3>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded", style.bg, style.color)}>{style.label}</span>
                </div>
                <p className="text-sm text-gold/70 leading-relaxed">{feature.description}</p>
                <p className="text-xs text-gold/40 mt-2">{feature.date}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

/**
 * Play tab content with split layout: Hero left + Stacked game panels right
 * - Live Games: prominent panel with green accent
 * - Upcoming Games: amber accent, shows when games start
 * - Ended Games: collapsed by default, expandable
 */
const PlayTabContent = ({
  onSelectGame,
  onSpectate,
  onSeeScore,
  onRegistrationComplete,
  disabled = false,
}: {
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onSeeScore: (selection: WorldSelection) => void;
  onRegistrationComplete: () => void;
  disabled?: boolean;
}) => {
  const [showEnded, setShowEnded] = useState(false);

  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      {/* Left: Hero Title */}
      <div className="flex flex-col justify-center min-h-[400px]">
        <HeroTitle />
      </div>

      {/* Right: Stacked Game Panels */}
      <div className="flex flex-col gap-3">
        {/* Live Games Panel */}
        <div className="rounded-2xl border border-emerald-500/30 bg-black/60 p-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20">
              <Zap className="h-3 w-3 text-emerald-400" />
            </div>
            <h2 className="font-serif text-sm text-emerald-400">Live Games</h2>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          </div>
          <UnifiedGameGrid
            onSelectGame={onSelectGame}
            onSpectate={onSpectate}
            onRegistrationComplete={onRegistrationComplete}
            devModeFilter={false}
            statusFilter="ongoing"
            hideHeader
            hideLegend
          />
        </div>

        {/* Upcoming Games Panel */}
        <div className="rounded-2xl border border-amber-500/30 bg-black/60 p-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20">
              <Clock className="h-3 w-3 text-amber-400" />
            </div>
            <h2 className="font-serif text-sm text-amber-400">Upcoming Games</h2>
          </div>
          <UnifiedGameGrid
            onSelectGame={onSelectGame}
            onSpectate={onSpectate}
            onRegistrationComplete={onRegistrationComplete}
            devModeFilter={false}
            statusFilter="upcoming"
            hideHeader
            hideLegend
          />
        </div>

        {/* Ended Games Panel - Collapsed by default */}
        <div className="rounded-2xl border border-gray-500/30 bg-black/60 backdrop-blur-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowEnded(!showEnded)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-500/20">
                <History className="h-3 w-3 text-gray-400" />
              </div>
              <h2 className="font-serif text-sm text-gray-400">Ended Games</h2>
            </div>
            {showEnded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {showEnded && (
            <div className="px-3 pb-3">
              <UnifiedGameGrid
                onSelectGame={onSelectGame}
                onSpectate={onSpectate}
                onSeeScore={onSeeScore}
                onRegistrationComplete={onRegistrationComplete}
                devModeFilter={false}
                statusFilter="ended"
                hideHeader
                hideLegend
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Main play view - shows card-based game selector for production games only.
 * This is the default landing page content.
 */
export const PlayView = ({ className }: PlayViewProps) => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as PlayTab) || "play";

  // Modal state for game entry
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<WorldSelection | null>(null);
  const [isSpectateMode, setIsSpectateMode] = useState(false);

  // Modal state for score card
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [scoreWorld, setScoreWorld] = useState<WorldSelection | null>(null);

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

  const handleSeeScore = useCallback((selection: WorldSelection) => {
    console.log("[PlayView] handleSeeScore:", selection.name);
    setScoreWorld(selection);
    setScoreModalOpen(true);
  }, []);

  const handleCloseScoreModal = useCallback(() => {
    setScoreModalOpen(false);
    setScoreWorld(null);
  }, []);

  // Registration is handled inline by GameCardGrid - this callback is for any post-registration actions
  const handleRegistrationComplete = useCallback(() => {
    console.log("[PlayView] Registration completed");
    // The toast is already shown by the GameCard component
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "learn":
        return (
          <LearnContent
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onRegistrationComplete={handleRegistrationComplete}
          />
        );
      case "news":
        return <NewsContent />;
      case "play":
      default:
        return (
          <PlayTabContent
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onSeeScore={handleSeeScore}
            onRegistrationComplete={handleRegistrationComplete}
            disabled={entryModalOpen || scoreModalOpen}
          />
        );
    }
  };

  return (
    <>
      <div className={cn("flex flex-col gap-6", className)}>
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

      {/* Score Card Modal - for ended games */}
      {scoreWorld && (
        <ScoreCardModal isOpen={scoreModalOpen} onClose={handleCloseScoreModal} worldName={scoreWorld.name} />
      )}
    </>
  );
};
