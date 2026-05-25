import { AnimatePresence, motion } from "framer-motion";
import Castle from "lucide-react/dist/esm/icons/castle";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import Crown from "lucide-react/dist/esm/icons/crown";
import Navigation from "lucide-react/dist/esm/icons/navigation";
import Shield from "lucide-react/dist/esm/icons/shield";
import Skull from "lucide-react/dist/esm/icons/skull";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import X from "lucide-react/dist/esm/icons/x";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import type { Headline, HeadlineType } from "./headline-types";

interface HeadlineTheme {
  icon: typeof Castle;
  eyebrow: string;
  accentTextClassName: string;
  accentSurfaceClassName: string;
  accentEdgeClassName: string;
}

const HEADLINE_THEME_MAP: Record<HeadlineType, HeadlineTheme> = {
  "realm-fall": {
    icon: Castle,
    eyebrow: "War Report",
    accentTextClassName: "text-anger-light",
    accentSurfaceClassName: "border-anger-light/35 bg-anger-light/10 text-anger-light",
    accentEdgeClassName: "bg-anger-light/80",
  },
  "hyper-capture": {
    icon: Crown,
    eyebrow: "World Event",
    accentTextClassName: "text-brilliance",
    accentSurfaceClassName: "border-brilliance/35 bg-brilliance/10 text-brilliance",
    accentEdgeClassName: "bg-brilliance/80",
  },
  elimination: {
    icon: Skull,
    eyebrow: "War Report",
    accentTextClassName: "text-anger-light",
    accentSurfaceClassName: "border-anger-light/35 bg-anger-light/10 text-anger-light",
    accentEdgeClassName: "bg-anger-light/80",
  },
  "game-end": {
    icon: Trophy,
    eyebrow: "Age Result",
    accentTextClassName: "text-gold",
    accentSurfaceClassName: "border-gold/35 bg-gold/10 text-gold",
    accentEdgeClassName: "bg-gold/80",
  },
  "five-min-warning": {
    icon: Clock3,
    eyebrow: "Timer Warning",
    accentTextClassName: "text-orange",
    accentSurfaceClassName: "border-orange/35 bg-orange/10 text-orange",
    accentEdgeClassName: "bg-orange/80",
  },
  "first-t2-army": {
    icon: Shield,
    eyebrow: "Military Milestone",
    accentTextClassName: "text-gold",
    accentSurfaceClassName: "border-gold/35 bg-gold/10 text-gold",
    accentEdgeClassName: "bg-gold/80",
  },
  "first-t3-army": {
    icon: Shield,
    eyebrow: "Military Milestone",
    accentTextClassName: "text-brilliance",
    accentSurfaceClassName: "border-brilliance/35 bg-brilliance/10 text-brilliance",
    accentEdgeClassName: "bg-brilliance/80",
  },
};

const trimHeadlineDescription = (description: string) => {
  if (description.startsWith('"') && description.endsWith('"')) {
    return description.slice(1, -1);
  }

  return description;
};

interface NewsHeadlineBannerProps {
  headline: Headline | null;
  onDismiss: () => void;
  onNavigate?: (location: { x: number; y: number; entityId: number }) => void;
}

export function NewsHeadlineBanner({ headline, onDismiss, onNavigate }: NewsHeadlineBannerProps) {
  const theme = headline ? HEADLINE_THEME_MAP[headline.icon] : null;
  const Icon = theme?.icon ?? null;
  const description = headline ? trimHeadlineDescription(headline.description) : "";
  const navigationLocation = headline?.location ?? null;
  const canNavigate = Boolean(navigationLocation && onNavigate);

  return (
    <AnimatePresence mode="wait">
      {headline && Icon && theme && (
        <motion.div
          key={headline.id}
          initial={{ y: -32, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -16, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 top-16 z-30 flex justify-center px-4"
        >
          <div className="w-[520px] max-w-full">
            <div className="panel-wood panel-wood-corners pointer-events-auto relative overflow-hidden rounded-xl border border-gold/20 bg-dark-wood text-gold shadow-[0_25px_45px_-25px_rgba(0,0,0,0.8)]">
              <div className="corner-bl z-100" />
              <div className="corner-br z-100" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/20" />
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
              <div
                className={cn(
                  "pointer-events-none absolute inset-y-4 left-0 w-[2px] rounded-full",
                  theme.accentEdgeClassName,
                )}
              />

              <div className="relative grid grid-cols-[52px_minmax(0,1fr)_52px] items-center gap-3 px-4 py-3.5">
                <div className="flex justify-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border shadow-[inset_0_1px_4px_rgba(0,0,0,0.45)]",
                      theme.accentSurfaceClassName,
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </div>
                </div>

                <div className="min-w-0">
                  <div
                    className={cn("text-[9px] font-semibold uppercase tracking-[0.38em]", theme.accentTextClassName)}
                  >
                    {theme.eyebrow}
                  </div>
                  <div className="mt-1 font-[Cinzel] text-sm font-semibold uppercase tracking-[0.2em] text-gold">
                    {headline.title}
                  </div>
                  <div className="mt-1 text-[12px] leading-[1.35] text-gold/78">{description}</div>
                </div>

                <div className="relative flex min-h-[52px] flex-col items-center justify-center gap-1.5 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-gold/10">
                  {canNavigate ? (
                    <button
                      type="button"
                      onClick={(evt) => {
                        evt.stopPropagation();
                        if (!navigationLocation || !onNavigate) return;
                        onNavigate(navigationLocation);
                      }}
                      className={cn(
                        "button-wood inline-flex h-9 w-11 flex-col items-center justify-center gap-0.5 rounded-md border text-[8px] font-semibold uppercase tracking-[0.16em] transition-colors",
                        "border-gold/25 bg-black/20 text-gold hover:border-gold/45 hover:bg-black/35",
                      )}
                    >
                      <Navigation className="h-3 w-3" />
                      <span>View</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="button-wood inline-flex h-7 w-7 items-center justify-center rounded-full border-gold/15 bg-black/20 p-0 text-gold/45 hover:bg-black/35 hover:text-gold"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
