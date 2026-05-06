import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLatestFeaturesSeen } from "@/hooks/use-latest-features-seen";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { latestFeatures } from "@/ui/features/world";
import { getLatestFeaturePresentation } from "@/ui/features/world/latest-feature-presentation";
import { latestFeatures as featuresData, type FeatureType } from "@/ui/features/world/latest-features";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Zap from "lucide-react/dist/esm/icons/zap";
import Scale from "lucide-react/dist/esm/icons/scale";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import { useEffect } from "react";

const typeConfig: Record<FeatureType, { icon: typeof Sparkles }> = {
  feature: {
    icon: Sparkles,
  },
  improvement: {
    icon: Zap,
  },
  balance: {
    icon: Scale,
  },
  fix: {
    icon: Wrench,
  },
};

const isRecentByDays = (dateStr: string, days: number = 3): boolean => {
  const featureDate = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - featureDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= days;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatGameSlug = (gameSlug: string): string =>
  gameSlug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const LatestFeaturesWindow = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(latestFeatures));
  const { markAsSeen } = useLatestFeaturesSeen();

  useEffect(() => {
    if (isOpen) {
      markAsSeen();
    }
  }, [isOpen, markAsSeen]);

  if (!isOpen) return null;

  return (
    <SecondaryPopup name="latest-features" className="pointer-events-auto">
      <SecondaryPopup.Head onClose={() => togglePopup(latestFeatures)}>What's New</SecondaryPopup.Head>
      <SecondaryPopup.Body height="h-auto" width="420px" maxHeightCap={500}>
        <div className="flex flex-col p-4 overflow-y-auto">
          {featuresData.length === 0 ? (
            <div className="text-gold/60 text-center py-12">No updates yet.</div>
          ) : (
            <div className="space-y-3">
              {featuresData.map((feature, index) => {
                const config = typeConfig[feature.type];
                const presentation = getLatestFeaturePresentation(feature.type);
                const Icon = config.icon;
                const recent = isRecentByDays(feature.date);

                return (
                  <div
                    key={index}
                    className={`
                      relative flex flex-col p-3 rounded-lg border transition-all
                      ${recent ? "bg-gold/5 border-gold/30" : "bg-brown/10 border-gold/15"}
                      hover:border-gold/40 hover:bg-gold/10
                    `}
                  >
                    {recent && (
                      <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-brilliance text-brown text-[9px] font-bold rounded uppercase tracking-wide">
                        New
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "p-1.5 rounded-md border flex-shrink-0 mt-0.5",
                          presentation.iconSurfaceClassName,
                        )}
                      >
                        <Icon className={cn("w-3.5 h-3.5", presentation.iconClassName)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                              presentation.badgeClassName,
                            )}
                          >
                            {presentation.popupLabel}
                          </span>
                          {feature.gameSlug ? (
                            <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gold/75">
                              {formatGameSlug(feature.gameSlug)}
                            </span>
                          ) : null}
                          <span className="text-gold/40 text-[10px] uppercase tracking-[0.12em]">
                            {formatDate(feature.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gold text-sm font-semibold leading-tight">{feature.title}</span>
                        </div>

                        <p className="text-gold/70 text-xs leading-relaxed">{feature.description}</p>

                        {feature.readMore ? (
                          <a
                            href={feature.readMore}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold/75 transition-colors hover:text-gold"
                          >
                            <span>Read more</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gold/15">
            <p className="text-gold/40 text-[10px] text-center">Updates and improvements are added regularly.</p>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
