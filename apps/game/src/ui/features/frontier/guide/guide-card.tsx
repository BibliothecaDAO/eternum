import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { GUIDE, NEXT, SHOW_ME } from "@/ui/design-system/kit/words";
import { forwardRef } from "react";

import type { GuideMark } from "./guide-script";

/** The Aspect of Skill's sigil in the mark's four states: dim, as drawn, glowing gold, glowing amber. */
const MARKS: Record<GuideMark, string> = {
  rest: "opacity-45",
  speaking: "",
  pleased: "drop-shadow-[0_0_8px_theme(colors.kit.gold2)]",
  warning: "drop-shadow-[0_0_8px_theme(colors.kit.hot)]",
};

/** The Aspect of Skill's mark in one of its states. */
export const GuideMarkIcon = ({ mark, size, className }: { mark: GuideMark; size: number; className?: string }) => (
  <KitIcon code="Gd" size={size} className={cn(MARKS[mark], className)} />
);

/**
 * The guide card (wireframes 01, 02): the Aspect of Skill's mark where a portrait was, one line, Show me when the line
 * names somewhere to go, and Next. Never a modal: the map stays live around it.
 */
export const GuideCard = forwardRef<
  HTMLElement,
  { mark: GuideMark; line: string; onShowMe?: () => void; onNext: () => void }
>(({ mark, line, onShowMe, onNext }, ref) => (
  <aside
    ref={ref}
    aria-label={GUIDE}
    aria-live="polite"
    className="frontier-card pointer-events-auto flex flex-col gap-2 !rounded-xl p-2.5"
  >
    <div className="flex items-start gap-2.5">
      {/* The mark is 48 dp on a phone and 72 on desktop, where the card has the room. */}
      <GuideMarkIcon mark={mark} size={48} className="lg:size-[72px]" />
      <p className="text-[15px] leading-snug text-kit-cream">{line}</p>
    </div>
    <div className="flex gap-2">
      {onShowMe && <Button role="primary" word={SHOW_ME} onClick={onShowMe} className="flex-1" />}
      <Button role={onShowMe ? "secondary" : "primary"} word={NEXT} onClick={onNext} className="flex-1" />
    </div>
  </aside>
));
GuideCard.displayName = "GuideCard";
