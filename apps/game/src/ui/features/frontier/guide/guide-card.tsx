import { Button } from "@/ui/design-system/kit/button";
import { NEXT, SHOW_ME, GUIDE } from "@/ui/design-system/kit/words";
import { forwardRef } from "react";

import type { GuideMark } from "./guide-script";

/** The Aspect of Skill, a hood of mist with a vein of gold, in each of the mark's states: one framing, so they align. */
const spiritArt = (mark: GuideMark, px: 256 | 512) => `/images/guides/guide-skill-${mark}-${px}.webp`;

/**
 * The spirit as a bust: 112 px on a phone and 160 on desktop, so the 256 px file covers a phone at 2x and a desktop at
 * 1x, and the 512 px file the denser screens.
 */
const GuideSpirit = ({ mark }: { mark: GuideMark }) => (
  <img
    src={spiritArt(mark, 256)}
    srcSet={`${spiritArt(mark, 256)} 256w, ${spiritArt(mark, 512)} 512w`}
    sizes="(min-width: 1024px) 160px, 112px"
    alt=""
    aria-hidden
    draggable={false}
    className="pointer-events-none absolute left-0 top-0 aspect-square size-28 object-contain lg:size-40"
  />
);

/**
 * The guide card (wireframes 01, 02): the Aspect of Skill standing on its top-left edge as a bust, one line, Show me
 * when the line names somewhere to go, and Next. The bust rises above the card and its foot reaches in, so the line
 * steps past it and then runs the card's width. Never a modal: the map stays live around it.
 */
export const GuideCard = forwardRef<
  HTMLElement,
  { mark: GuideMark; line: string; onShowMe?: () => void; onNext: () => void }
>(({ mark, line, onShowMe, onNext }, ref) => (
  <div className="relative pt-16 lg:pt-24">
    <aside
      ref={ref}
      aria-label={GUIDE}
      aria-live="polite"
      className="frontier-card pointer-events-auto flow-root !rounded-xl p-2.5"
    >
      <span aria-hidden className="float-left h-12 w-[100px] lg:h-16 lg:w-[146px]" />
      <p className="text-[15px] leading-snug text-kit-cream">{line}</p>
      <div className="clear-both flex gap-2 pt-2">
        {onShowMe && <Button role="primary" word={SHOW_ME} onClick={onShowMe} className="flex-1" />}
        <Button role={onShowMe ? "secondary" : "primary"} word={NEXT} onClick={onNext} className="flex-1" />
      </div>
    </aside>
    <GuideSpirit mark={mark} />
  </div>
));
GuideCard.displayName = "GuideCard";
