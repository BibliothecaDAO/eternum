import type { IconMeaning } from "@/ui/design-system/icon";
import { HudBanner, HudButton, HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { AnimatePresence, motion } from "framer-motion";

import { HeadlineLine } from "./headline-line";
import type { Headline, HeadlineType } from "./headline-types";

/** Each kind of news: its painting, the word over its headline, and its tone (none reads in the age's accent). */
const HEADLINE_THEME_MAP: Record<HeadlineType, { icon: IconMeaning; eyebrow: string; tone?: "good" | "bad" | "warn" }> =
  {
    "realm-fall": { icon: "realm", eyebrow: "War Report", tone: "bad" },
    "hyper-capture": { icon: "crown", eyebrow: "World Event" },
    elimination: { icon: "skull", eyebrow: "War Report", tone: "bad" },
    "game-start": { icon: "crown", eyebrow: "Game started", tone: "good" },
    "game-end": { icon: "victory", eyebrow: "Age Result", tone: "good" },
    "five-min-warning": { icon: "hourglass", eyebrow: "Timer Warning", tone: "warn" },
    "t3-building": { icon: "defend", eyebrow: "Military Milestone" },
  };

interface NewsHeadlineBannerProps {
  headline: Headline | null;
  onDismiss: () => void;
  onNavigate?: (location: { x: number; y: number; entityId: number }) => void;
}

export function NewsHeadlineBanner({ headline, onDismiss, onNavigate }: NewsHeadlineBannerProps) {
  const theme = headline ? HEADLINE_THEME_MAP[headline.icon] : null;
  const navigationLocation = headline?.location ?? null;
  const canNavigate = Boolean(navigationLocation && onNavigate);

  return (
    <AnimatePresence mode="wait">
      {headline && theme && (
        <motion.div
          key={headline.id}
          initial={{ y: -32, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -16, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 top-hud-header z-hud-rail flex justify-center px-4"
        >
          <HudBanner
            tone={theme.tone}
            icon={theme.icon}
            eyebrow={theme.eyebrow}
            title={headline.title}
            line={<HeadlineLine parts={headline.description} />}
            actions={
              <>
                {canNavigate && (
                  <HudButton
                    kind="secondary"
                    size="sm"
                    icon="navigation"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      if (!navigationLocation || !onNavigate) return;
                      onNavigate(navigationLocation);
                    }}
                  >
                    View
                  </HudButton>
                )}
                <HudIconButton icon="close" label="Dismiss" kind="quiet" size="sm" onClick={onDismiss} />
              </>
            }
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
