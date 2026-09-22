import { BookOpen, ExternalLink, Sparkles, Video } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";

/** Curated guides; static content, so the shell serves it with no game module. */
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
export const LearnPage = () => (
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
  </div>
);
