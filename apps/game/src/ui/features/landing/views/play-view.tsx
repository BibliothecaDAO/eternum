import { useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { env } from "@/../env";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { latestFeatures, type FeatureType } from "@/ui/features/world/latest-features";
import {
  BookOpen,
  CloudLightning,
  ExternalLink,
  Factory,
  Play,
  Sparkles,
  Sun,
  Video,
  Newspaper,
  Wrench,
  TrendingUp,
  Bug,
  Clock,
  Trophy,
  RefreshCw,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { primeGameEntry } from "@/game-entry-preload";
import { buildEntryHrefFromEntryContext, resolveEntryContextFromLandingSelection } from "@/game-entry/context";
import { startGameEntryTimeline } from "@/ui/layouts/game-entry-timeline";
import { useLocation, useNavigate } from "react-router-dom";
import { UnifiedGameGrid, type WorldSelection } from "../components/game-selector/game-card-grid";
import { getWorldById } from "@/runtime/world/world-directory";
import { GameReviewModal } from "../components/game-review-modal";
import type { LandingModeFilter, LandingEntryRouteState } from "../lib/landing-entry-state";
import { setGameReviewDismissed } from "../lib/game-review-storage";
import { useLandingContext } from "../context/landing-context";
import { useLandingNetworkState } from "../hooks/use-landing-network-state";
import { invalidateWorldListQueries } from "@/hooks/world-list-queries";
import { FACTORY_GAME_LIST_REFRESH_EVENT } from "../../factory-v2/game-list-refresh-event";

interface PlayViewProps {
  className?: string;
  activeTab?: PlayTab;
  disableReviewFlow?: boolean;
  initialModeFilter?: LandingModeFilter;
}

type PlayTab = "play" | "learn" | "news" | "factory";
const FACTORY_TAB_BLEED_CLASS_NAME = "-mx-6 lg:-mx-10";
const FACTORY_TAB_HEADER_INSET_CLASS_NAME = "px-3 sm:px-4 lg:px-6";

const FactoryV2Content = lazy(() =>
  import("../../factory-v2").then((module) => ({ default: module.FactoryV2Content })),
);

type LearnGuideTier = "beginner" | "advanced";
type LearnGuideKind = "video" | "written";

interface LearnGuide {
  title: string;
  url: string;
  source: string;
  kind: LearnGuideKind;
  tier: LearnGuideTier;
  verifiedAt: string;
  description?: string;
  lang?: string;
  deprecated?: boolean;
}

const START_HERE_GUIDE: LearnGuide = {
  title: "New? Start Here",
  url: "https://docs.realms.world/blitz/key-concepts",
  source: "Official Docs",
  kind: "written",
  tier: "beginner",
  verifiedAt: "2026-04-07",
  description: "Start with the core Blitz concepts before branching into tactics, videos, and community guides.",
};

const LEARN_GUIDES: LearnGuide[] = [
  {
    title: "Getting Started Tutorial",
    url: "https://x.com/lordcumberlord/status/1986947491640598776",
    source: "@lordcumberlord",
    kind: "video",
    tier: "beginner",
    verifiedAt: "2026-04-07",
    description: "A quick first walkthrough for the opening loop, early priorities, and first matches.",
  },
  {
    title: "Blitz Key Concepts",
    url: "https://docs.realms.world/blitz/key-concepts",
    source: "Official Docs",
    kind: "written",
    tier: "beginner",
    verifiedAt: "2026-04-07",
    description: "The official breakdown of the core systems, vocabulary, and match flow.",
  },
  {
    title: "Resource Management Guide",
    url: "https://x.com/lordcumberlord/status/1990719396113707225",
    source: "@lordcumberlord",
    kind: "video",
    tier: "beginner",
    verifiedAt: "2026-04-07",
    description: "Covers the economy basics that new players usually miss in their first few runs.",
  },
  {
    title: "Combat Tactics Deep Dive",
    url: "https://x.com/lordcumberlord/status/2011095751196360980",
    source: "@lordcumberlord",
    kind: "video",
    tier: "advanced",
    verifiedAt: "2026-04-07",
    description: "Focused combat decision-making once you already understand the core loop.",
  },
  {
    title: "Complete Guide (English)",
    url: "https://docs.google.com/document/d/e/2PACX-1vQch9CAmt9zXc7bwFuvdCOWz0x9IzLbZlgvOMX96xV7lWza1d3dLMHpaWaDa6eAo5rasaC4KtpPpGuP/pub",
    source: "nexonik & tsuaurym",
    kind: "written",
    tier: "advanced",
    verifiedAt: "2026-04-07",
    lang: "EN",
    description: "A deeper written reference for players who want the full strategic picture.",
  },
  {
    title: "Guia Completo (Portuguese)",
    url: "https://docs.google.com/document/d/e/2PACX-1vQlOxLQ5snLk23-2rsla4tPh8I5ijNaecYl1r_Dgk-9-An42Sos4HVl2EQGr0P1avW-W94qIwM4QrJn/pub",
    source: "nexonik & tsuaurym",
    kind: "written",
    tier: "advanced",
    verifiedAt: "2026-04-07",
    lang: "PT",
    description: "Portuguese version of the deeper written guide.",
  },
  {
    title: "How to Build Your Legacy",
    url: "https://legacygg.substack.com/p/how-to-build-your-legacy-in-realms",
    source: "Legacy GG",
    kind: "written",
    tier: "advanced",
    verifiedAt: "2026-04-07",
    deprecated: true,
    description: "Deprecated because the original guide URL no longer resolves cleanly.",
  },
];

const LEARN_TIER_COPY: Record<LearnGuideTier, { title: string; description: string }> = {
  beginner: {
    title: "Beginner",
    description: "Start here if you are learning the economy, match flow, and first-week priorities.",
  },
  advanced: {
    title: "Advanced",
    description: "Use these once you are optimizing tactics, macro decisions, and deeper strategy.",
  },
};

const getVisibleLearnGuides = (tier: LearnGuideTier) =>
  LEARN_GUIDES.filter((guide) => guide.tier === tier && !guide.deprecated);

const formatGuideVerifiedAt = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const getLearnGuideStyle = (kind: LearnGuideKind) =>
  kind === "video"
    ? {
        icon: Video,
        chipClassName: "border-red-500/30 bg-red-500/10 text-red-300",
        iconClassName: "bg-red-500/15 text-red-300",
        label: "Video",
      }
    : {
        icon: BookOpen,
        chipClassName: "border-blue-500/30 bg-blue-500/10 text-blue-200",
        iconClassName: "bg-blue-500/15 text-blue-200",
        label: "Guide",
      };

const LearnGuideCard = ({ guide }: { guide: LearnGuide }) => {
  const style = getLearnGuideStyle(guide.kind);
  const Icon = style.icon;

  return (
    <a
      href={guide.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col gap-3 rounded-xl border border-gold/10 bg-black/40 p-4 transition-all hover:border-gold/25 hover:bg-black/55"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border flex-shrink-0",
            style.iconClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] uppercase tracking-[0.12em]">
          <span className={cn("rounded-full border px-2 py-0.5 font-semibold", style.chipClassName)}>
            {style.label}
          </span>
          <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-gold/75">
            Verified {formatGuideVerifiedAt(guide.verifiedAt)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-gold group-hover:text-gold/85">{guide.title}</h3>
        {guide.description ? <p className="text-sm leading-relaxed text-gold/65">{guide.description}</p> : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-gold/55">
        <span>{guide.source}</span>
        {guide.lang ? (
          <span className="rounded bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold/75">{guide.lang}</span>
        ) : null}
      </div>

      <div className="inline-flex items-center gap-2 text-xs font-semibold text-gold/75 transition-colors group-hover:text-gold">
        <span>Open Guide</span>
        <ExternalLink className="h-3.5 w-3.5" />
      </div>
    </a>
  );
};

const LearnTierSection = ({ tier }: { tier: LearnGuideTier }) => {
  const tierCopy = LEARN_TIER_COPY[tier];
  const guides = getVisibleLearnGuides(tier);

  return (
    <div className="flex flex-col rounded-2xl border border-gold/20 bg-black/60 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-gold">{tierCopy.title}</h2>
          <p className="text-sm text-gold/60">{tierCopy.description}</p>
        </div>
        <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-gold/75">
          {guides.length} Guides
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {guides.map((guide) => (
          <LearnGuideCard key={guide.url} guide={guide} />
        ))}
      </div>
    </div>
  );
};

/**
 * Learn tab content - clear onboarding first, then tiered guides, then practice games.
 */
const LearnContent = ({
  onPlayGame,
  onSelectGame,
  onAutoSettleGame,
  onSpectate,
  onSeeScore,
  onRegistrationComplete,
}: {
  onPlayGame: (selection: WorldSelection) => void;
  onSelectGame: (selection: WorldSelection) => void;
  onAutoSettleGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onSeeScore: (selection: WorldSelection) => void;
  onRegistrationComplete: () => void;
}) => (
  <div className="flex flex-col gap-4">
    <a
      href={START_HERE_GUIDE.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-4 rounded-2xl border border-brilliance/35 bg-gradient-to-br from-brilliance/15 via-gold/10 to-black/60 p-5 backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brilliance/35 bg-brilliance/15">
            <Sparkles className="h-5 w-5 text-brilliance" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brilliance/90">New? Start Here</p>
            <h2 className="mt-1 font-serif text-2xl text-gold">{START_HERE_GUIDE.source}</h2>
          </div>
        </div>
        <span className="rounded-full border border-gold/20 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-gold/75">
          Verified {formatGuideVerifiedAt(START_HERE_GUIDE.verifiedAt)}
        </span>
      </div>

      <p className="max-w-3xl text-sm leading-relaxed text-gold/75">{START_HERE_GUIDE.description}</p>

      <div className="inline-flex items-center gap-2 text-sm font-semibold text-gold/85 transition-colors group-hover:text-gold">
        <span>{START_HERE_GUIDE.title}</span>
        <ExternalLink className="h-4 w-4" />
      </div>
    </a>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <LearnTierSection tier="beginner" />
      <LearnTierSection tier="advanced" />
    </div>

    {/* Row 2: Practice Games (full width) */}
    <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-black/60 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20">
          <Wrench className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h2 className="font-serif text-xl text-gold">Practice Games</h2>
          <p className="text-sm text-gold/60">Jump into dev-mode matches after you have the basics down.</p>
        </div>
      </div>
      <UnifiedGameGrid
        onPlayGame={onPlayGame}
        onSelectGame={onSelectGame}
        onAutoSettleGame={onAutoSettleGame}
        onSpectate={onSpectate}
        onSeeScore={onSeeScore}
        onRegistrationComplete={onRegistrationComplete}
        devModeFilter={true}
        hideHeader
      />
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

const formatFeatureDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatGameSlug = (gameSlug: string) =>
  gameSlug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                      style.bg,
                      style.color,
                    )}
                  >
                    {style.label}
                  </span>
                  {feature.gameSlug ? (
                    <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gold/75">
                      {formatGameSlug(feature.gameSlug)}
                    </span>
                  ) : null}
                  <span className="text-[10px] uppercase tracking-[0.12em] text-gold/45">
                    {formatFeatureDate(feature.date)}
                  </span>
                </div>
                <h3 className="font-semibold text-gold">{feature.title}</h3>
                <p className="text-sm text-gold/70 leading-relaxed">{feature.description}</p>
                {feature.readMore ? (
                  <a
                    href={feature.readMore}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-gold/75 transition-colors hover:text-gold"
                  >
                    <span>Read more</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const FactoryTabContent = () => (
  <div className="flex flex-col gap-4">
    <Suspense
      fallback={
        <div className={FACTORY_TAB_HEADER_INSET_CLASS_NAME}>
          <div className="rounded-xl border border-gold/20 bg-black/40 p-6 text-sm text-gold/70">
            Loading factory...
          </div>
        </div>
      }
    >
      <FactoryV2Content />
    </Suspense>
  </div>
);

const MODE_VISUALS: Record<
  LandingModeFilter,
  {
    title: string;
    subtitle: string;
    chip: string;
    videoSrc: string;
    posterSrc: string;
    tone: string;
    icon: typeof Sun;
    panelBorder: string;
    panelGlow: string;
  }
> = {
  season: {
    title: "Eternum Seasons",
    subtitle: "Build your empire across seasons. Forge alliances, claim territory, and wage war on your own terms.",
    chip: "Campaign",
    videoSrc: "/videos/menu.mp4",
    posterSrc: "/images/covers/dashboard/07.webp",
    tone: "from-emerald-700/60 via-lime-500/20 to-amber-300/20",
    icon: Sun,
    panelBorder: "border-emerald-400/40",
    panelGlow: "shadow-[0_0_35px_rgba(52,211,153,0.25)]",
  },
  blitz: {
    title: "Blitz",
    subtitle: "Fast, brutal matches. Drop in, fight for dominance, and prove yourself before the clock runs out.",
    chip: "Match",
    videoSrc: "/videos/01.mp4",
    posterSrc: "/images/covers/dashboard/02.webp",
    tone: "from-slate-900/75 via-blue-700/25 to-cyan-400/20",
    icon: CloudLightning,
    panelBorder: "border-cyan-300/40",
    panelGlow: "shadow-[0_0_35px_rgba(34,211,238,0.22)]",
  },
};

const ModeCoexistenceHero = ({
  modeFilter,
  onModeFilterChange,
}: {
  modeFilter: LandingModeFilter;
  onModeFilterChange: (mode: LandingModeFilter) => void;
}) => {
  const [hoveredMode, setHoveredMode] = useState<LandingModeFilter | null>(null);
  const [mounted, setMounted] = useState(false);
  const { setBackgroundId } = useLandingContext();

  useEffect(() => {
    // Small delay to ensure DOM is ready for CSS transitions
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Change page background when mode selection changes
  useEffect(() => {
    const bgMap: Record<LandingModeFilter, string> = {
      season: "07",
      blitz: "02",
    };
    setBackgroundId(bgMap[modeFilter]);
  }, [modeFilter, setBackgroundId]);

  // Eternum seasons open in phase 3: the hero only offers modes whose world
  // is actually deployed in the Herald-backed world directory.
  const availableModes = (Object.keys(MODE_VISUALS) as Array<LandingModeFilter>).filter(
    (mode) => mode !== "season" || getWorldById("eternum") != null,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {availableModes.map((mode, index) => {
        const config = MODE_VISUALS[mode];
        const Icon = config.icon;
        const isEmphasized = hoveredMode ? hoveredMode === mode : modeFilter === mode;

        return (
          <button
            key={mode}
            type="button"
            onMouseEnter={() => setHoveredMode(mode)}
            onMouseLeave={() => setHoveredMode(null)}
            onFocus={() => setHoveredMode(mode)}
            onBlur={() => setHoveredMode(null)}
            onClick={() => onModeFilterChange(mode)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border text-left transition-all duration-500 ease-out",
              "min-h-[140px] md:min-h-[180px]",
              config.panelBorder,
              isEmphasized
                ? cn("opacity-100 scale-[1.02]", config.panelGlow, "ring-2 ring-gold/50")
                : "opacity-60 scale-[0.98] grayscale-[30%]",
              // Entrance animation
              mounted ? "translate-y-0 opacity-inherit" : "translate-y-5 !opacity-0",
            )}
            style={{
              transitionDelay: mounted ? "0ms" : `${index * 150}ms`,
            }}
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={config.posterSrc}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            >
              <source src={config.videoSrc} type="video/mp4" />
            </video>

            <div className={cn("absolute inset-0 bg-gradient-to-br", config.tone)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            <div className="relative z-10 h-full p-3 md:p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border bg-black/35 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] transition-all duration-500",
                    isEmphasized ? "border-gold/50 text-gold" : "border-white/20 text-white/50",
                  )}
                >
                  {config.chip}
                </span>
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all duration-500",
                    isEmphasized ? "text-gold/90 scale-110" : "text-white/40 scale-100",
                  )}
                />
              </div>

              <div className="flex items-end gap-3">
                <h3
                  className={cn(
                    "font-cinzel text-xl md:text-2xl transition-colors duration-500 ease-out",
                    isEmphasized ? "text-gold" : "text-white/70",
                  )}
                >
                  {config.title}
                </h3>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

/**
 * Full-width strip of the user's active (live + upcoming) registered games for
 * the current mode. Hidden until there is at least one match so the dashboard
 * stays clean for anonymous users and players who haven't registered.
 *
 * The inner grid stays mounted while hidden so its onGamesResolved callback
 * keeps firing and can re-reveal the bar when data changes.
 */
const RegisteredActiveGamesBar = ({
  mode,
  onPlayGame,
  onSelectGame,
  onAutoSettleGame,
  onSpectate,
  onRegistrationComplete,
}: {
  mode: "blitz" | "eternum";
  onPlayGame: (selection: WorldSelection) => void;
  onSelectGame: (selection: WorldSelection) => void;
  onAutoSettleGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onRegistrationComplete: () => void;
}) => {
  const [registeredCount, setRegisteredCount] = useState(0);
  const hasRegistered = registeredCount > 0;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-emerald-500/30 bg-black/40 p-3 backdrop-blur-sm",
        !hasRegistered && "hidden",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <h2 className="font-cinzel text-base text-emerald-400 uppercase tracking-wider">Your Active Games</h2>
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      </div>
      <UnifiedGameGrid
        onPlayGame={onPlayGame}
        onSelectGame={onSelectGame}
        onAutoSettleGame={onAutoSettleGame}
        onSpectate={onPlayGame}
        onRegistrationComplete={onRegistrationComplete}
        // No mode filter: your active games stay visible even when the hero
        // is on the other mode — a blitz player browsing Seasons must still
        // see the game they're in.
        statusFilter={["ongoing", "upcoming"]}
        registeredFilter="registered"
        hideHeader
        hideLegend
        layout="horizontal"
        onGamesResolved={(games) => setRegisteredCount(games.length)}
      />
    </div>
  );
};

/**
 * Play tab content layered as:
 * - Half-height mode hero at the top
 * - Full-width "Your Active Games" bar (shown only when relevant)
 * - Two columns below: Open Games (live + upcoming, unregistered) | Played (ended)
 */
const PlayTabContent = ({
  modeFilter,
  onModeFilterChange,
  onPlayGame,
  onSelectGame,
  onAutoSettleGame,
  onSpectate,
  onSeeScore,
  onRegistrationComplete,
  onRefresh,
  isRefreshing = false,
  disabled = false,
}: {
  modeFilter: LandingModeFilter;
  onModeFilterChange: (mode: LandingModeFilter) => void;
  onPlayGame: (selection: WorldSelection) => void;
  onSelectGame: (selection: WorldSelection) => void;
  onAutoSettleGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onSeeScore: (selection: WorldSelection) => void;
  onRegistrationComplete: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  disabled?: boolean;
}) => {
  const resolvedMode: "blitz" | "eternum" = modeFilter === "season" ? "eternum" : "blitz";
  // The Played column hides dev-mode (practice) games on production so the ladder shows real
  // matches only. On the madara lab every game is dev-mode, so that rule would hide them all —
  // show every ended game there, whether or not the viewer took part.
  const playedDevModeFilter = env.VITE_PUBLIC_CHAIN === "madara" ? undefined : false;

  return (
    <div className={cn("flex flex-col gap-4", disabled && "opacity-50 pointer-events-none")}>
      <ModeCoexistenceHero modeFilter={modeFilter} onModeFilterChange={onModeFilterChange} />

      <RegisteredActiveGamesBar
        mode={resolvedMode}
        onPlayGame={onPlayGame}
        onSelectGame={onSelectGame}
        onAutoSettleGame={onAutoSettleGame}
        onSpectate={onSpectate}
        onRegistrationComplete={onRegistrationComplete}
      />

      {/* Two columns: Open Games (live + upcoming, unregistered) | Played (ended) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Open Games Column */}
        <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <h2 className="font-cinzel text-base text-amber-400 uppercase tracking-wider">Open Games</h2>
            </div>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 rounded-md bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/20 hover:text-amber-400 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-amber-500/20 scrollbar-track-transparent">
            <UnifiedGameGrid
              onPlayGame={onPlayGame}
              onSelectGame={onSelectGame}
              onAutoSettleGame={onAutoSettleGame}
              onSpectate={onSpectate}
              onRegistrationComplete={onRegistrationComplete}
              modeFilter={resolvedMode}
              statusFilter={["ongoing", "upcoming"]}
              registeredFilter="unregistered"
              hideHeader
              hideLegend
              layout="vertical"
            />
          </div>
        </div>

        {/* Played Column (ended games) */}
        <div className="flex flex-col rounded-2xl border border-gold/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold/20">
              <Trophy className="h-3.5 w-3.5 text-gold" />
            </div>
            <h2 className="font-cinzel text-base text-gold uppercase tracking-wider">Played</h2>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
            <UnifiedGameGrid
              onPlayGame={onPlayGame}
              onSelectGame={onSelectGame}
              onAutoSettleGame={onAutoSettleGame}
              onSpectate={onSpectate}
              onSeeScore={onSeeScore}
              onRegistrationComplete={onRegistrationComplete}
              modeFilter={resolvedMode}
              devModeFilter={playedDevModeFilter}
              statusFilter="ended"
              hideHeader
              hideLegend
              layout="vertical"
              sortEndedNewestFirst
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Main play view - shows card-based game selector for production games only.
 * This is the default landing page content.
 */
export const PlayView = ({
  className,
  activeTab = "play",
  disableReviewFlow = false,
  initialModeFilter = "blitz",
}: PlayViewProps) => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { preferredChain } = useLandingNetworkState();

  // Review flow state
  const [reviewWorld, setReviewWorld] = useState<WorldSelection | null>(null);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modeFilter, setModeFilter] = useState<LandingModeFilter>(initialModeFilter);

  // Auth state
  const isSignedIn = useIdentitySession().status === "signed-in";
  const requestSignIn = useIdentitySessionStore((state) => state.requestSignIn);
  const currentLandingHref = `${location.pathname}${location.search}`;
  const entryRedirectState: LandingEntryRouteState = {
    returnTo: currentLandingHref,
    landingModeFilter: modeFilter,
  };

  useEffect(() => {
    if (activeTab !== "play") {
      return;
    }

    try {
      performance.mark("dashboard-play-preload-scheduled");
    } catch {
      // Ignore duplicate or unsupported marks.
    }

    primeGameEntry("dashboard");
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refreshGameLists = () => {
      void invalidateWorldListQueries(queryClient);
    };

    window.addEventListener(FACTORY_GAME_LIST_REFRESH_EVENT, refreshGameLists);
    return () => {
      window.removeEventListener(FACTORY_GAME_LIST_REFRESH_EVENT, refreshGameLists);
    };
  }, [queryClient]);

  const navigateToEntryRoute = useCallback(
    (selection: WorldSelection, intent: "play" | "settle" | "spectate", autoSettle = false) => {
      const entryContext = resolveEntryContextFromLandingSelection({
        selection,
        intent,
        autoSettle,
      });

      if (!entryContext) {
        return;
      }

      navigate(buildEntryHrefFromEntryContext(entryContext), {
        state: entryRedirectState,
      });
    },
    [entryRedirectState, navigate],
  );

  const openGameEntryRoute = useCallback(
    (selection: WorldSelection, intent: "play" | "settle", autoSettle = false) => {
      startGameEntryTimeline();
      primeGameEntry("entry");
      navigateToEntryRoute(selection, intent, autoSettle);
    },
    [navigateToEntryRoute],
  );

  const buildEntryRedirectHref = useCallback(
    (selection: WorldSelection, intent: "play" | "settle" | "spectate", autoSettle = false) => {
      const entryContext = resolveEntryContextFromLandingSelection({
        selection,
        intent,
        autoSettle,
      });

      return entryContext ? buildEntryHrefFromEntryContext(entryContext) : null;
    },
    [],
  );

  const handleSelectGame = useCallback(
    (selection: WorldSelection) => {
      if (!isSignedIn) {
        const redirectTo = buildEntryRedirectHref(selection, "settle", false);
        if (!redirectTo) {
          return;
        }

        requestSignIn({ redirectTo, redirectState: entryRedirectState });
        return;
      }

      // Open settle flow
      openGameEntryRoute(selection, "settle", false);
    },
    [buildEntryRedirectHref, entryRedirectState, isSignedIn, openGameEntryRoute, requestSignIn],
  );

  const handleAutoSettleGame = useCallback(
    (selection: WorldSelection) => {
      if (!isSignedIn) return;

      openGameEntryRoute(selection, "settle", true);
    },
    [isSignedIn, openGameEntryRoute],
  );

  const handlePlayGame = useCallback(
    (selection: WorldSelection) => {
      if (!isSignedIn) {
        const redirectTo = buildEntryRedirectHref(selection, "play", false);
        if (!redirectTo) {
          return;
        }

        requestSignIn({ redirectTo, redirectState: entryRedirectState });
        return;
      }

      // Open direct play flow
      openGameEntryRoute(selection, "play", false);
    },
    [buildEntryRedirectHref, entryRedirectState, isSignedIn, openGameEntryRoute, requestSignIn],
  );

  const handleSpectate = useCallback(
    (selection: WorldSelection) => {
      // Open game entry modal in spectate mode (no account required)
      startGameEntryTimeline();
      primeGameEntry("entry");
      navigateToEntryRoute(selection, "spectate", false);
    },
    [navigateToEntryRoute],
  );

  const handleSeeScore = useCallback((selection: WorldSelection) => {
    setReviewWorld(selection);
  }, []);

  // Registration is handled inline by GameCardGrid - this callback is for any post-registration actions
  const handleRegistrationComplete = useCallback(() => {
    // The toast is already shown by the GameCard component
  }, []);

  // Refresh landing game summaries.
  // The open-games grid is driven by the bulk worlds summary query.
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await invalidateWorldListQueries(queryClient);
    } finally {
      // Add a small delay so the spinner is visible
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [queryClient]);

  const dismissReviewForWorld = useCallback((world: WorldSelection | null) => {
    if (!world?.chain || !world.worldAddress) return;
    setGameReviewDismissed(world.chain, world.worldAddress);
  }, []);

  const handleCloseReviewModal = useCallback(() => {
    dismissReviewForWorld(reviewWorld);
    setReviewWorld(null);
  }, [dismissReviewForWorld, reviewWorld]);

  const handleRequireSignIn = useCallback(() => {
    requestSignIn({ redirectTo: currentLandingHref });
  }, [currentLandingHref, requestSignIn]);

  const renderContent = () => {
    switch (activeTab) {
      case "learn":
        return (
          <LearnContent
            onPlayGame={handlePlayGame}
            onSelectGame={handleSelectGame}
            onAutoSettleGame={handleAutoSettleGame}
            onSpectate={handleSpectate}
            onSeeScore={handleSeeScore}
            onRegistrationComplete={handleRegistrationComplete}
          />
        );
      case "news":
        return <NewsContent />;
      case "factory":
        return <FactoryTabContent />;
      case "play":
      default:
        return (
          <PlayTabContent
            modeFilter={modeFilter}
            onModeFilterChange={setModeFilter}
            onPlayGame={handlePlayGame}
            onSelectGame={handleSelectGame}
            onAutoSettleGame={handleAutoSettleGame}
            onSpectate={handleSpectate}
            onSeeScore={handleSeeScore}
            onRegistrationComplete={handleRegistrationComplete}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            disabled={Boolean(reviewWorld)}
          />
        );
    }
  };

  // The landing never mounts the prediction-market providers: the PM SDK
  // initializes against a retired host and rendered null in place of the whole
  // page while it tried (audit C2). Prediction markets return with W6 infra.
  const content = (
    <div className={cn("flex flex-col gap-6", activeTab === "factory" && FACTORY_TAB_BLEED_CLASS_NAME, className)}>
      {renderContent()}
    </div>
  );

  return (
    <>
      {content}

      {reviewWorld && !disableReviewFlow && (
        <GameReviewModal
          isOpen={Boolean(reviewWorld)}
          world={reviewWorld}
          nextGame={null}
          showUpcomingGamesStep={true}
          onClose={handleCloseReviewModal}
          onRegistrationComplete={handleRegistrationComplete}
          onRequireSignIn={handleRequireSignIn}
        />
      )}
    </>
  );
};
