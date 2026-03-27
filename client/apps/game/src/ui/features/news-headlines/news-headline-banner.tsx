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

const ICON_MAP: Record<HeadlineType, typeof Castle> = {
  "realm-fall": Castle,
  "hyper-capture": Crown,
  elimination: Skull,
  "game-end": Trophy,
  "five-min-warning": Clock3,
  "first-t2-army": Shield,
  "first-t3-army": Shield,
};

interface NewsHeadlineBannerProps {
  headline: Headline | null;
  onDismiss: () => void;
  onNavigate?: (location: { x: number; y: number; entityId: number }) => void;
}

export function NewsHeadlineBanner({ headline, onDismiss, onNavigate }: NewsHeadlineBannerProps) {
  const Icon = headline ? ICON_MAP[headline.icon] : null;

  return (
    <AnimatePresence mode="wait">
      {headline && Icon && (
        <motion.div
          key={headline.id}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-4 left-1/2 z-30 w-[600px] max-w-[90vw] -translate-x-1/2"
        >
          <div className="panel-wood pointer-events-auto overflow-hidden rounded-lg px-4 py-3 text-gold shadow-md">
            <div className="flex items-center justify-between gap-3">
              {/* Icon + text */}
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="h-5 w-5 flex-shrink-0 text-gold" aria-hidden />
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider text-brilliance">{headline.title}</span>
                  <span className="truncate text-[11px] leading-snug text-gold/80">{headline.description}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {headline.location && onNavigate && (
                  <button
                    type="button"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      onNavigate(headline.location!);
                    }}
                    className={cn(
                      "button-wood inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                      "border-gold/25 bg-brown/50 text-gold hover:border-gold/45 hover:bg-brown/70",
                    )}
                  >
                    <Navigation className="h-3 w-3" />
                    Navigate
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded p-0.5 text-gold/40 hover:text-gold transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
