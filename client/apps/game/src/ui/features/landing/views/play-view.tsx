import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { latestFeatures, type FeatureType } from "@/ui/features/world/latest-features";
import { MarketsProviders } from "@/ui/features/market/markets-providers";
import { useAccount } from "@starknet-react/core";
import {
  BookOpen,
  ChevronRight,
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
  Zap,
  Clock,
  Trophy,
  RefreshCw,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { primePlayEntryRoute } from "@/game-entry-preload";
import { startGameEntryTimeline } from "@/ui/layouts/game-entry-timeline";
import {
  resolveFactoryDashboardVersion,
  updateFactoryDashboardVersion,
  type FactoryDashboardVersion,
} from "../../factory-v2/factory-dashboard-route";
import { UnifiedGameGrid, type GameData, type WorldSelection } from "../components/game-selector/game-card-grid";
import { GameEntryModal } from "../components/game-entry-modal";
import { GameReviewModal } from "../components/game-review-modal";
import { isGameReviewDismissed, setGameReviewDismissed } from "../lib/game-review-storage";
import { useLandingContext } from "../context/landing-context";

interface PlayViewProps {
  className?: string;
}

type PlayTab = "play" | "learn" | "news" | "factory";
type LandingModeFilter = "blitz" | "season";
const FACTORY_TAB_BLEED_CLASS_NAME = "-mx-6 lg:-mx-10";
const FACTORY_TAB_HEADER_INSET_CLASS_NAME = "px-3 sm:px-4 lg:px-6";

const FactoryV2Content = lazy(() =>
  import("../../factory-v2").then((module) => ({ default: module.FactoryV2Content })),
);
const FactoryPage = lazy(() => import("../../admin").then((module) => ({ default: module.FactoryPage })));

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
  onSpectate,
  onForgeHyperstructures,
  onSeeScore,
  onClaimRewards,
  onRegistrationComplete,
}: {
  onPlayGame: (selection: WorldSelection) => void;
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onForgeHyperstructures: (selection: WorldSelection, numHyperstructuresLeft: number) => Promise<void> | void;
  onSeeScore: (selection: WorldSelection) => void;
  onClaimRewards: (selection: WorldSelection) => void;
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
        onSpectate={onSpectate}
        onForgeHyperstructures={onForgeHyperstructures}
        onSeeScore={onSeeScore}
        onClaimRewards={onClaimRewards}
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

const FactoryTabContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFactoryVersion = resolveFactoryDashboardVersion(searchParams);
  const selectFactoryVersion = (version: FactoryDashboardVersion) =>
    setSearchParams(updateFactoryDashboardVersion(searchParams, version));

  return (
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
        {selectedFactoryVersion === "v2" ? <FactoryV2Content /> : <FactoryPage embedded />}
      </Suspense>

      <FactoryVersionChooser
        selectedFactoryVersion={selectedFactoryVersion}
        onSelectFactoryVersion={selectFactoryVersion}
      />
    </div>
  );
};

const FactoryVersionChooser = ({
  selectedFactoryVersion,
  onSelectFactoryVersion,
}: {
  selectedFactoryVersion: FactoryDashboardVersion;
  onSelectFactoryVersion: (version: FactoryDashboardVersion) => void;
}) => (
  <div className={FACTORY_TAB_HEADER_INSET_CLASS_NAME}>
    <div className="rounded-[22px] border border-gold/15 bg-black/45 px-4 py-4 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div className="flex flex-col items-center gap-3 md:flex-row md:items-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15">
            <Factory className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h2 className="font-serif text-lg text-gold">Factory versions</h2>
            <p className="text-sm text-gold/60">Choose the legacy factory or the new Factory V2.</p>
          </div>
        </div>

        <div className="inline-flex rounded-full border border-gold/12 bg-black/30 p-1">
          <button
            type="button"
            onClick={() => onSelectFactoryVersion("v2")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              selectedFactoryVersion === "v2" ? "bg-gold text-black" : "text-gold/70 hover:bg-gold/10 hover:text-gold",
            )}
          >
            Factory V2
          </button>
          <button
            type="button"
            onClick={() => onSelectFactoryVersion("v1")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              selectedFactoryVersion === "v1" ? "bg-gold text-black" : "text-gold/70 hover:bg-gold/10 hover:text-gold",
            )}
          >
            Factory V1
          </button>
        </div>
      </div>
    </div>
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
    posterSrc: "/images/covers/blitz/07.png",
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
    posterSrc: "/images/covers/blitz/02.png",
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {(Object.keys(MODE_VISUALS) as Array<LandingModeFilter>).map((mode, index) => {
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
              "min-h-[280px] md:min-h-[360px]",
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
            <img
              src={config.posterSrc}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover scale-105"
            />
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={config.posterSrc}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                hoveredMode === mode ? "opacity-100" : "opacity-75",
              )}
            >
              <source src={config.videoSrc} type="video/mp4" />
            </video>

            <div className={cn("absolute inset-0 bg-gradient-to-br", config.tone)} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

            <div className="relative z-10 h-full p-4 md:p-6 flex flex-col justify-between">
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

              <div className="overflow-hidden">
                <h3
                  className={cn(
                    "font-cinzel text-2xl md:text-3xl transition-all duration-500 ease-out",
                    isEmphasized ? "text-gold translate-y-0" : "text-white/70 translate-y-1",
                  )}
                >
                  {config.title}
                </h3>
                <p
                  className={cn(
                    "text-sm mt-1.5 transition-all duration-500 ease-out delay-75",
                    isEmphasized
                      ? "text-gold/70 translate-y-0 opacity-100 max-h-20"
                      : "text-white/40 translate-y-2 opacity-0 max-h-0",
                  )}
                >
                  {config.subtitle}
                </p>
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 mt-3 text-xs font-medium transition-all duration-500 ease-out delay-150",
                    isEmphasized ? "text-gold translate-y-0 opacity-100" : "text-white/40 translate-y-3 opacity-0",
                  )}
                >
                  {mode === "season" ? "Enter Campaigns" : "Enter Blitz"}
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-300",
                      isEmphasized ? "translate-x-0.5" : "translate-x-0",
                    )}
                  />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

/**
 * Play tab content with centered hero + 3 columns layout:
 * - Hero centered at top with CTA
 * - Three columns below: Live | Upcoming | Ended
 * - Vertical scroll within each column
 */
const PlayTabContent = ({
  onPlayGame,
  onSelectGame,
  onSpectate,
  onSeeScore,
  onClaimRewards,
  onForgeHyperstructures,
  onRegistrationComplete,
  onRefresh,
  isRefreshing = false,
  disabled = false,
  onEndedGamesResolved,
}: {
  onPlayGame: (selection: WorldSelection) => void;
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onSeeScore: (selection: WorldSelection) => void;
  onClaimRewards: (selection: WorldSelection) => void;
  onForgeHyperstructures: (selection: WorldSelection, numHyperstructuresLeft: number) => Promise<void> | void;
  onRegistrationComplete: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  disabled?: boolean;
  onEndedGamesResolved?: (games: GameData[]) => void;
}) => {
  const [modeFilter, setModeFilter] = useState<LandingModeFilter>("blitz");

  return (
    <div className={cn("flex flex-col gap-4", disabled && "opacity-50 pointer-events-none")}>
      <ModeCoexistenceHero modeFilter={modeFilter} onModeFilterChange={setModeFilter} />

      {modeFilter === "season" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {/* Three columns: Live | Upcoming | Ended */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 flex-1 min-h-0">
              {/* Live Games Column */}
              <div className="flex flex-col rounded-2xl border border-emerald-500/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20">
                      <Zap className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <h2 className="font-cinzel text-base text-emerald-400 uppercase tracking-wider">Live Games</h2>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  </div>
                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="p-1 rounded-md bg-emerald-500/10 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all disabled:opacity-50"
                    title="Refresh"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent">
                  <UnifiedGameGrid
                    onPlayGame={onPlayGame}
                    onSelectGame={onSelectGame}
                    onSpectate={onSpectate}
                    onForgeHyperstructures={onForgeHyperstructures}
                    onRegistrationComplete={onRegistrationComplete}
                    modeFilter="eternum"
                    statusFilter="ongoing"
                    hideHeader
                    hideLegend
                    layout="vertical"
                    sortRegisteredFirst
                  />
                </div>
              </div>

              {/* Upcoming Games Column */}
              <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <h2 className="font-cinzel text-base text-amber-400 uppercase tracking-wider">Upcoming Games</h2>
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
                    onSpectate={onSpectate}
                    onForgeHyperstructures={onForgeHyperstructures}
                    onRegistrationComplete={onRegistrationComplete}
                    modeFilter="eternum"
                    devModeFilter={false}
                    statusFilter="upcoming"
                    hideHeader
                    hideLegend
                    layout="vertical"
                    sortRegisteredFirst
                  />
                </div>
              </div>

              {/* Ended Games Column */}
              <div className="flex flex-col rounded-2xl border border-gold/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px] md:col-span-2 xl:col-span-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold/20">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <h2 className="font-cinzel text-base text-gold uppercase tracking-wider">Ended Games</h2>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
                  <UnifiedGameGrid
                    onPlayGame={onPlayGame}
                    onSelectGame={onSelectGame}
                    onSpectate={onSpectate}
                    onSeeScore={onSeeScore}
                    onClaimRewards={onClaimRewards}
                    onRegistrationComplete={onRegistrationComplete}
                    modeFilter="eternum"
                    devModeFilter={false}
                    statusFilter="ended"
                    hideHeader
                    hideLegend
                    layout="vertical"
                    sortClaimableRewardsFirst
                    sortEndedNewestFirst
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modeFilter === "blitz" && (
        <div className="flex flex-col gap-2">
          {/* Three columns: Live | Upcoming | Ended */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 flex-1 min-h-0">
            {/* Live Games Column */}
            <div className="flex flex-col rounded-2xl border border-emerald-500/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20">
                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <h2 className="font-cinzel text-base text-emerald-400 uppercase tracking-wider">Live Games</h2>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="p-1 rounded-md bg-emerald-500/10 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent">
                <UnifiedGameGrid
                  onPlayGame={onPlayGame}
                  onSelectGame={onSelectGame}
                  onSpectate={onSpectate}
                  onForgeHyperstructures={onForgeHyperstructures}
                  onRegistrationComplete={onRegistrationComplete}
                  modeFilter="blitz"
                  statusFilter="ongoing"
                  hideHeader
                  hideLegend
                  layout="vertical"
                  sortRegisteredFirst
                />
              </div>
            </div>

            {/* Upcoming Games Column */}
            <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <h2 className="font-cinzel text-base text-amber-400 uppercase tracking-wider">Upcoming Games</h2>
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
                  onSpectate={onSpectate}
                  onForgeHyperstructures={onForgeHyperstructures}
                  onRegistrationComplete={onRegistrationComplete}
                  modeFilter="blitz"
                  devModeFilter={false}
                  statusFilter="upcoming"
                  hideHeader
                  hideLegend
                  layout="vertical"
                  sortRegisteredFirst
                />
              </div>
            </div>

            {/* Ended Games Column */}
            <div className="flex flex-col rounded-2xl border border-gold/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px] md:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold/20">
                  <Trophy className="h-3.5 w-3.5 text-gold" />
                </div>
                <h2 className="font-cinzel text-base text-gold uppercase tracking-wider">Ended Games</h2>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
                <UnifiedGameGrid
                  onPlayGame={onPlayGame}
                  onSelectGame={onSelectGame}
                  onSpectate={onSpectate}
                  onSeeScore={onSeeScore}
                  onClaimRewards={onClaimRewards}
                  onRegistrationComplete={onRegistrationComplete}
                  modeFilter="blitz"
                  devModeFilter={false}
                  statusFilter="ended"
                  hideHeader
                  hideLegend
                  layout="vertical"
                  sortClaimableRewardsFirst
                  sortEndedNewestFirst
                  onGamesResolved={onEndedGamesResolved}
                />
              </div>
            </div>
          </div>
        </div>
      )}
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
  const queryClient = useQueryClient();

  // Modal state for game entry
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<WorldSelection | null>(null);
  const [isSpectateMode, setIsSpectateMode] = useState(false);
  const [isForgeMode, setIsForgeMode] = useState(false);
  const [eternumEntryIntent, setEternumEntryIntent] = useState<"play" | "settle">("play");
  const [numHyperstructuresLeft, setNumHyperstructuresLeft] = useState(0);

  // Review flow state
  const [reviewWorld, setReviewWorld] = useState<WorldSelection | null>(null);
  const [reviewInitialStep, setReviewInitialStep] = useState<"claim-rewards" | undefined>(undefined);
  const [endedGames, setEndedGames] = useState<GameData[]>([]);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auth state
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const setModal = useUIStore((state) => state.setModal);

  const openGameEntryModal = useCallback((selection: WorldSelection, intent: "play" | "settle") => {
    startGameEntryTimeline();
    primePlayEntryRoute();
    setSelectedWorld(selection);
    setIsSpectateMode(false);
    setIsForgeMode(false);
    setEternumEntryIntent(intent);
    setEntryModalOpen(true);
  }, []);

  const handleSelectGame = useCallback(
    (selection: WorldSelection) => {
      const hasAccount = Boolean(account) || isConnected;

      // Check if user needs to sign in before entering game
      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      // Open settle flow
      openGameEntryModal(selection, "settle");
    },
    [account, isConnected, setModal, openGameEntryModal],
  );

  const handlePlayGame = useCallback(
    (selection: WorldSelection) => {
      const hasAccount = Boolean(account) || isConnected;

      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      // Open direct play flow
      openGameEntryModal(selection, "play");
    },
    [account, isConnected, setModal, openGameEntryModal],
  );

  const handleSpectate = useCallback((selection: WorldSelection) => {
    // Open game entry modal in spectate mode (no account required)
    startGameEntryTimeline();
    primePlayEntryRoute();
    setSelectedWorld(selection);
    setIsSpectateMode(true);
    setIsForgeMode(false);
    setEternumEntryIntent("play");
    setEntryModalOpen(true);
  }, []);

  const handleForgeHyperstructures = useCallback(
    (selection: WorldSelection, numLeft: number) => {
      const hasAccount = Boolean(account) || isConnected;

      // Check if user needs to sign in before forging
      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      // Open game entry modal in forge mode
      startGameEntryTimeline();
      primePlayEntryRoute();
      setSelectedWorld(selection);
      setIsSpectateMode(false);
      setIsForgeMode(true);
      setEternumEntryIntent("play");
      setNumHyperstructuresLeft(numLeft);
      setEntryModalOpen(true);
    },
    [account, isConnected, setModal],
  );

  const handleCloseModal = useCallback(() => {
    setEntryModalOpen(false);
    setSelectedWorld(null);
    setIsForgeMode(false);
    setEternumEntryIntent("play");
    setNumHyperstructuresLeft(0);
  }, []);

  const handleSeeScore = useCallback((selection: WorldSelection) => {
    setReviewInitialStep(undefined);
    setReviewWorld(selection);
  }, []);

  const handleClaimRewards = useCallback((selection: WorldSelection) => {
    setReviewInitialStep("claim-rewards");
    setReviewWorld(selection);
  }, []);

  // Registration is handled inline by GameCardGrid - this callback is for any post-registration actions
  const handleRegistrationComplete = useCallback(() => {
    // The toast is already shown by the GameCard component
  }, []);

  // Refresh games data (invalidate world availability queries)
  // This also handles the transition from upcoming to live when game starts
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["worldAvailability"] });
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
    setReviewInitialStep(undefined);
    setReviewWorld(null);
  }, [dismissReviewForWorld, reviewWorld]);

  const handleRequireSignIn = useCallback(() => {
    setModal(<SignInPromptModal />, true);
  }, [setModal]);

  const handleEndedGamesResolved = useCallback((games: GameData[]) => {
    setEndedGames(games);
  }, []);

  useEffect(() => {
    if (activeTab !== "play") return;
    if (entryModalOpen || reviewWorld) return;
    if (endedGames.length === 0) return;

    const candidate = endedGames.toSorted((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0))[0];
    if (!candidate) return;
    if (!candidate.worldAddress) return;
    if (isGameReviewDismissed(candidate.chain, candidate.worldAddress)) return;

    setReviewInitialStep(undefined);
    setReviewWorld({ name: candidate.name, chain: candidate.chain, worldAddress: candidate.worldAddress });
  }, [activeTab, endedGames, entryModalOpen, reviewWorld]);

  const renderContent = () => {
    switch (activeTab) {
      case "learn":
        return (
          <LearnContent
            onPlayGame={handlePlayGame}
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onForgeHyperstructures={handleForgeHyperstructures}
            onSeeScore={handleSeeScore}
            onClaimRewards={handleClaimRewards}
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
            onPlayGame={handlePlayGame}
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onSeeScore={handleSeeScore}
            onClaimRewards={handleClaimRewards}
            onForgeHyperstructures={handleForgeHyperstructures}
            onRegistrationComplete={handleRegistrationComplete}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            disabled={entryModalOpen || Boolean(reviewWorld)}
            onEndedGamesResolved={handleEndedGamesResolved}
          />
        );
    }
  };

  const shouldMountMarketsProviders = activeTab === "play" || activeTab === "learn";
  const content = (
    <div className={cn("flex flex-col gap-6", activeTab === "factory" && FACTORY_TAB_BLEED_CLASS_NAME, className)}>
      {renderContent()}
    </div>
  );

  return (
    <>
      {shouldMountMarketsProviders ? <MarketsProviders>{content}</MarketsProviders> : content}

      {/* Game Entry Modal - Loading + Settlement + Forge */}
      {selectedWorld && selectedWorld.chain && (
        <GameEntryModal
          isOpen={entryModalOpen}
          onClose={handleCloseModal}
          worldName={selectedWorld.name}
          chain={selectedWorld.chain}
          isSpectateMode={isSpectateMode}
          isForgeMode={isForgeMode}
          eternumEntryIntent={eternumEntryIntent}
          numHyperstructuresLeft={numHyperstructuresLeft}
        />
      )}

      {reviewWorld && (
        <GameReviewModal
          isOpen={Boolean(reviewWorld)}
          world={reviewWorld}
          nextGame={null}
          initialStep={reviewInitialStep}
          showUpcomingGamesStep={true}
          onClose={handleCloseReviewModal}
          onRegistrationComplete={handleRegistrationComplete}
          onRequireSignIn={handleRequireSignIn}
        />
      )}
    </>
  );
};
