import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { CHAT, MAP, MENU, REALM, RESEARCH } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { guideTarget } from "../guide/guide-thread";

export type Place = "map" | "realm" | "research" | "chat" | "menu";

/** A dot on a slot: lit is news (research to buy), amber and ember a store nearing or at its limit. */
type Dot = "lit" | "amber" | "ember";

const DOTS: Record<Dot, string> = {
  lit: "bg-kit-gold2",
  amber: "bg-kit-hot",
  ember: "bg-light-red",
};

/**
 * The phone's place bar: Map and Realm as one switch (the two places of play), then Research, Chat and Menu, an icon
 * and one word each, at the foot of every nav page. The lit slot is where the player is.
 */
export const PlaceNav = ({
  place,
  onGo,
  realmDot,
  researchDot,
  unread,
}: {
  place: Place;
  onGo: (place: Place) => void;
  realmDot?: Dot;
  researchDot: boolean;
  /** Chat messages unread; none shows nothing. */
  unread: number;
}) => {
  const slot = (to: Place, icon: IconCode, word: string, badge?: ReactNode) => (
    <Slot key={to} to={to} lit={place === to} icon={icon} word={word} badge={badge} onClick={() => onGo(to)} />
  );
  return (
    <nav
      aria-label="Places"
      className="frontier-card pointer-events-auto flex h-14 items-stretch justify-between gap-0.5 !rounded-2xl"
    >
      <span className="flex flex-[2] border-r border-kit-line">
        {slot("map", "Mp", MAP)}
        {slot("realm", "Cs", REALM, realmDot && <i className={cn("size-2 rounded-full", DOTS[realmDot])} />)}
      </span>
      {slot("research", "Rs", RESEARCH, researchDot && <i className={cn("size-2 rounded-full", DOTS.lit)} />)}
      {slot(
        "chat",
        "Ct",
        CHAT,
        unread > 0 && <span className="text-[13px] leading-none tabular-nums">{formatAmount(unread)}</span>,
      )}
      {slot("menu", "Mn", MENU)}
    </nav>
  );
};

const Slot = ({
  to,
  lit,
  icon,
  word,
  badge,
  onClick,
}: {
  to: Place;
  lit: boolean;
  icon: IconCode;
  word: string;
  badge: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-current={lit ? "page" : undefined}
    {...(to === "realm" ? guideTarget("realm-tab") : {})}
    onClick={onClick}
    className={cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold",
      lit ? "bg-kit-line text-kit-gold2 shadow-[inset_0_-3px_0_theme(colors.kit.gold)]" : "text-kit-muted",
    )}
  >
    <span className="flex items-center gap-0.5 text-kit-gold2">
      <KitIcon code={icon} size={22} />
      {badge}
    </span>
    <span>{word}</span>
  </button>
);
