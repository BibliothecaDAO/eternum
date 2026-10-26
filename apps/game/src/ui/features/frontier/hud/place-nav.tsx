import { formatAmount } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { useSideways } from "@/shell/frame/layout";

import { CHAT, EVENTS_WORDS, MENU, REALM, RESEARCH } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

export type Place = "realm" | "research" | "feed" | "chat" | "menu";

/** A dot on a slot: lit is news (research to buy), amber and ember a store nearing or at its limit. */
type Dot = "lit" | "amber" | "ember";

const DOTS: Record<Dot, string> = {
  lit: "bg-hud-gold",
  amber: "bg-hud-warn",
  ember: "bg-hud-bad",
};

/**
 * The phone's place bar: Realm, Research, the Feed (the same as the desktop's, with what arrived since it was read), Chat and
 * Menu, an icon and one word each, at the foot of every nav page, or down the left edge of a phone held sideways. The
 * map is where play is, so it has no slot: each slot opens its place over it and a second press closes it, Realm
 * included (owner, 25 October). The lit slot is what is open; none is lit on the map.
 */
export const PlaceNav = ({
  place,
  onGo,
  realmDot,
  researchDot,
  events,
  unread,
}: {
  place: Place | null;
  onGo: (place: Place) => void;
  realmDot?: Dot;
  /** Whether Research has a node to buy; none leaves the slot out, for a player with no realm to research. */
  researchDot?: boolean;
  /** Events arrived since the Feed was last read. */
  events: number;
  /** Chat messages unread; none shows nothing. */
  unread: number;
}) => {
  /** What arrived since the player last looked, as a bare count beside the slot's icon. */
  const count = (unseen: number) =>
    unseen > 0 && <span className="text-hud-body leading-none tabular-nums">{formatAmount(unseen)}</span>;
  const slot = (to: Place, icon: IconMeaning, word: string, badge?: ReactNode) => (
    <Slot key={to} lit={place === to} icon={icon} word={word} badge={badge} onClick={() => onGo(to)} />
  );
  // Held sideways the places stand in a rail at the left thumb (mobile direction A, sideways as C).
  const sideways = useSideways();
  return (
    <nav aria-label="Places" className={cn("flex", sideways && "flex-col")}>
      <HudPanel
        collapsible={false}
        className="flex-1"
        bodyClassName={cn("flex items-stretch justify-between gap-0.5", sideways ? "h-full flex-col" : "min-h-14")}
      >
        {slot("realm", "realm", REALM, realmDot && <i className={cn("size-2 rounded-full", DOTS[realmDot])} />)}
        {researchDot !== undefined &&
          slot("research", "research", RESEARCH, researchDot && <i className={cn("size-2 rounded-full", DOTS.lit)} />)}
        {slot("feed", "chronicles", EVENTS_WORDS.feed, count(events))}
        {slot("chat", "chat", CHAT, count(unread))}
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
      "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-hud-strong",
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
