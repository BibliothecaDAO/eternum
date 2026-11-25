import type { IconMeaning } from "@/ui/design-system/icon";
import { HudBanner } from "@/ui/design-system/kit/hud-elements";
import { HEADLINE_EYEBROWS } from "@/ui/design-system/kit/words";
import { OfflineNotice } from "@/ui/features/frontier/hud/offline-notice";
import { AnimatePresence, motion } from "framer-motion";
import { type RefObject, useLayoutEffect, useRef } from "react";

import { HeadlineLine } from "./headline-line";
import type { Headline, HeadlineType } from "./headline-types";

/** Each kind of news: its painting and its tone (none reads in the age's accent); its eyebrow is the words module's. */
const HEADLINE_THEME_MAP: Record<HeadlineType, { icon: IconMeaning; tone?: "good" | "bad" | "warn" }> = {
  "realm-fall": { icon: "realm", tone: "bad" },
  "hyper-capture": { icon: "crown" },
  elimination: { icon: "skull", tone: "bad" },
  "game-start": { icon: "crown", tone: "good" },
  "five-min-warning": { icon: "hourglass", tone: "warn" },
  "t3-building": { icon: "defend" },
};

/**
 * The game's news across the top of the map, one at a time: it reads, then leaves by itself (the bridge's timer). It
 * takes no click, so whatever it covers stays playable. A headline with a place keeps it in its Feed row, one tap away.
 */
export function NewsHeadlineBanner({ headline }: { headline: Headline | null }) {
  const theme = headline ? HEADLINE_THEME_MAP[headline.icon] : null;
  const band = useRef<HTMLDivElement>(null);
  usePublishedHeight(band, NOTICE_BAND);
  return (
    <div
      ref={band}
      className="pointer-events-none fixed inset-x-0 top-hud-phone-header z-hud-rail flex flex-col items-center gap-2 px-4 lg:top-hud-header"
    >
      <OfflineNotice />
      <AnimatePresence mode="wait">
        {headline && theme && (
          <motion.div
            key={headline.id}
            initial={{ y: -32, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full justify-center"
          >
            <HudBanner
              tone={theme.tone}
              icon={theme.icon}
              eyebrow={HEADLINE_EYEBROWS[headline.icon]}
              title={headline.title}
              line={<HeadlineLine parts={headline.description} />}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const NOTICE_BAND = "--hud-notice-band";

const usePublishedHeight = (ref: RefObject<HTMLElement>, variable: string) => {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement.style;
    const publish = () => {
      const height = element.getBoundingClientRect().height;
      const gap = Number.parseFloat(getComputedStyle(element).rowGap) || 0;
      root.setProperty(variable, `${height > 0 ? Math.round(height + gap) : 0}px`);
    };
    publish();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.removeProperty(variable);
    };
  }, [ref, variable]);
};
