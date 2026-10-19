import { formatAmount } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";

import { CHAT, MAP, MENU, REALM, RESEARCH } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

export type Place = "map" | "realm" | "research" | "chat" | "menu";

/** A dot on a slot: lit is news (research to buy), amber and ember a store nearing or at its limit. */
type Dot = "lit" | "amber" | "ember";

const DOTS: Record<Dot, string> = {
  lit: "bg-hud-gold",
  amber: "bg-hud-warn",
  ember: "bg-hud-bad",
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
  /** Whether Research has a node to buy; none leaves the slot out, for a player with no realm to research. */
  researchDot?: boolean;
  /** Chat messages unread; none shows nothing. */
  unread: number;
}) => {
  const slot = (to: Place, icon: IconMeaning, word: string, badge?: ReactNode) => (
    <Slot key={to} lit={place === to} icon={icon} word={word} badge={badge} onClick={() => onGo(to)} />
  );
  return (
    <nav aria-label="Places" className="flex">
      <HudPanel collapsible={false} className="flex-1" bodyClassName="flex h-14 items-stretch justify-between gap-0.5">
        {slot("map", "map", MAP)}
        {slot("realm", "realm", REALM, realmDot && <i className={cn("size-2 rounded-full", DOTS[realmDot])} />)}
        <i aria-hidden className="w-px shrink-0 self-stretch bg-hud-line" />
        {researchDot !== undefined &&
          slot("research", "research", RESEARCH, researchDot && <i className={cn("size-2 rounded-full", DOTS.lit)} />)}
        {slot(
          "chat",
          "chat",
          CHAT,
          unread > 0 && <span className="text-hud-body leading-none tabular-nums">{formatAmount(unread)}</span>,
        )}
        {slot("menu", "menu", MENU)}
      </HudPanel>
    </nav>
  );
};

const Slot = ({
  lit,
  icon,
  word,
  badge,
  onClick,
}: {
  lit: boolean;
  icon: IconMeaning;
  word: string;
  badge: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-current={lit ? "page" : undefined}
    onClick={onClick}
    className={cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-hud-strong ",
      "border-b-2",
      lit ? "border-hud-gold bg-hud-divider text-hud-gold" : "border-transparent text-hud-muted",
    )}
  >
    <span className="flex items-center gap-0.5 text-hud-gold">
      <SemanticIcon name={icon} size={22} />
      {badge}
    </span>
    <span>{word}</span>
  </button>
);
