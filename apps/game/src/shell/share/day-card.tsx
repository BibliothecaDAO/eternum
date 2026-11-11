import "@/shell/season-tab/season-recap.css";
import "./day-card.css";

import { formatAmount, formatShort, LORDS } from "@bibliothecadao/types";
import type { Ref } from "react";

import { usePlayerDisplayName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AGE_LOCKUP, iconDefinition, orderMeaning } from "@/ui/design-system/icon-meaning";
import { paintingFile } from "@/ui/design-system/kit/paintings";
import { DAY, DAY_SHARE_WORDS, ESSENCE, LABOR } from "@/ui/design-system/kit/words";
import { dayTotalCells, type DayTotals } from "@/ui/features/frontier/log/day-totals";
import { type DayBest, type DayMark, rankMove } from "@/ui/features/frontier/rollover/day-share";
import { TARGET_MARKS } from "@/ui/features/frontier/sites/site-marks";
import { CARD_CUTS, type CardCut } from "@/utils/card-image";

import { ageOf } from "../play/ages";
import { CardTile } from "./card-tile";

/** A Frontier day as its card and its post tell it: whose, which, its totals, rank, trail and best moment. */
export interface SharedDay {
  player: string;
  game: { chainId: string; gameId: number };
  day: number;
  totals: DayTotals;
  rank: { from: number; to: number } | undefined;
  /** The day in order, for the post's line of emoji. */
  trail: readonly DayMark[];
  /** The day's best moment, which the card is built round. */
  best: DayBest;
  /** The player's realm: its name, and its Order where it has one. */
  realm: { name: string; order: number | undefined };
}

/**
 * The day's card, the node the image is made of, a poster in the season recap's pieces (owner's pick, 10 November
 * 2026): its tiles, type and portrait ring, drawn from plain images, since the card is drawn inside the HUD, whose kit
 * it may not use. Frontier's painting is under all of it, the day's best moment large over its glow, the player beside it (under
 * it, tall) with their realm, the day and the rank it closed at, then only the numbers the day moved, in the recap's
 * tiles, and the recap's foot: Frontier's lockup, free to play, and this site's address.
 */
export const DayCard = ({
  cardRef,
  cut,
  shared,
}: {
  cardRef?: Ref<HTMLDivElement>;
  cut: CardCut;
  shared: SharedDay;
}) => (
  <div ref={cardRef} className="day-card" data-cut={cut} data-hero={heroKind(shared.best)} style={CARD_CUTS[cut]}>
    <img className="day-card__painting" alt="" src={paintingFile("frontier-mist")} />
    <div className="day-card__hero">
      <Hero best={shared.best} />
    </div>
    <div className="day-card__side">
      <Player shared={shared} />
      <Haul totals={shared.totals} />
    </div>
    <div className="day-card__foot">
      <img className="day-card__lockup" src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} />
      <span>{DAY_SHARE_WORDS.playFree}</span>
      <span>{window.location.host}</span>
    </div>
  </div>
);

/** The player: their portrait with their realm's Order, their name and realm, the day, and the rank it closed at. */
const Player = ({ shared }: { shared: SharedDay }) => {
  const profile = usePlayerProfile(shared.player);
  const name = usePlayerDisplayName(shared.player) ?? "";
  return (
    <div className="day-card__who">
      <span className="season-card__who">
        <img className="day-card__portrait" src={playerPortraitUrl(shared.player, profile.portrait)} alt={name} />
        {shared.realm.order !== undefined && (
          <span className="season-card__order">
            <Icon
              name={orderMeaning(shared.realm.order)}
              size={56}
              alt={iconDefinition(orderMeaning(shared.realm.order)).label}
            />
          </span>
        )}
      </span>
      <span className="season-card__name">{name}</span>
      <span className="day-card__realm">{shared.realm.name}</span>
      <b className="season-card__big day-card__day">{`${DAY} ${shared.day}`}</b>
      {shared.rank && (
        <span className="season-card__prize">
          <Icon name="victory" size={30} />
          {[`#${formatAmount(shared.rank.to)}`, rankMove(shared.rank), DAY_SHARE_WORDS.rank].filter(Boolean).join(" ")}
        </span>
      )}
    </div>
  );
};

/** The best moment: its painting filling its frame, its headline, and the guard beaten or what it paid. */
const Hero = ({ best }: { best: DayBest }) => {
  const hero = heroOf(best);
  return (
    <span className="day-card__moment">
      <span className="day-card__art">
        <Icon name={hero.icon} size={256} />
      </span>
      <b className="day-card__headline">{hero.title}</b>
      {hero.detail && <span className="day-card__detail">{hero.detail}</span>}
      {hero.paid && (
        <span className="season-card__prize day-card__paid">
          <Icon name={hero.paid.icon} size={34} />
          {`${hero.paid.value} ${hero.paid.name}`}
        </span>
      )}
    </span>
  );
};

/** The numbers the day moved, in the recap's tiles: a total the day left at zero is not on the card. */
const Haul = ({ totals }: { totals: DayTotals }) => {
  const cells = dayTotalCells(totals).filter(({ total }) => (totals[total] ?? 0) > 0);
  return (
    <div className="season-card__tiles day-card__haul" data-count={cells.length}>
      {cells.map((cell) => (
        <CardTile key={cell.total} icon={cell.icon} value={cell.value} label={cell.name} />
      ))}
    </div>
  );
};

type Moment = {
  icon: IconMeaning;
  title: string;
  detail: string | null;
  paid: { icon: IconMeaning; value: string; name: string } | null;
};

const PAID: Record<"essence" | "labor" | "lords", { icon: IconMeaning; name: string }> = {
  essence: { icon: "essence", name: ESSENCE },
  labor: { icon: "labor", name: LABOR },
  lords: { icon: "lords", name: LORDS },
};

const heroOf = (best: DayBest): Moment => {
  if (best.kind === "chest")
    return {
      icon: "reward-chest",
      title: DAY_SHARE_WORDS.best.chest,
      detail: null,
      paid: { ...PAID.lords, value: `+${formatShort(best.lords)}` },
    };
  if (best.kind === "clear")
    return {
      icon: TARGET_MARKS[best.site].icon,
      title: DAY_SHARE_WORDS.best.clear(TARGET_MARKS[best.site].word),
      detail: best.guard ? DAY_SHARE_WORDS.guardBeaten(formatAmount(best.guard)) : null,
      paid: best.paid && { ...PAID[best.paid.resource], value: `+${formatShort(best.paid.amount)}` },
    };
  return { icon: "explore", title: DAY_SHARE_WORDS.best.reveals(formatAmount(best.count)), detail: null, paid: null };
};

/** What the best moment shows, for its glow's colour: a chest, a site by its kind, or the land. */
const heroKind = (best: DayBest) => (best.kind === "clear" ? best.site : best.kind);
