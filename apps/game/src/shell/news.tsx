import { latestFeatures, type FeatureType } from "@/ui/features/world/latest-features";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Bug, ExternalLink, Newspaper, Sparkles, TrendingUp, Wrench } from "@/ui/design-system/atoms/game-icons";

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
export const NewsPage = () => (
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
