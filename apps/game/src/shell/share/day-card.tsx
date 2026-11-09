import "./day-card.css";

import type { Ref } from "react";

import { usePlayerDisplayName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { Icon } from "@/ui/design-system/icon";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { DAY, DAY_SHARE_WORDS } from "@/ui/design-system/kit/words";
import { dayTotalCells, type DayTotals } from "@/ui/features/frontier/log/day-totals";
import { DAY_MARKS, rankMove, shownTrail, type DayMark } from "@/ui/features/frontier/rollover/day-share";
import { CARD_CUTS, type CardCut } from "@/utils/card-image";

import { ageOf } from "../play/ages";

/** The icons' sizes in each cut: the tall cut's are larger, as its card stands on a phone's whole width. */
const ICONS = { wide: { mark: 64, total: 48 }, tall: { mark: 84, total: 64 } } as const satisfies Record<
  CardCut,
  { mark: number; total: number }
>;

/** A Frontier day as its card tells it: whose, which, its totals, its closing rank and its trail. */
export interface SharedDay {
  player: string;
  game: { chainId: string; gameId: number };
  day: number;
  totals: DayTotals;
  rank: { from: number; to: number } | undefined;
  trail: readonly DayMark[];
}

/**
 * The day's card, the node the image is made of: Frontier's lockup and the day; the player and their closing rank; the
 * day's trail, its fights and finds in order; its totals; and where to play, free.
 */
export const DayCard = ({
  cardRef,
  cut,
  shared,
}: {
  cardRef?: Ref<HTMLDivElement>;
  cut: CardCut;
  shared: SharedDay;
}) => {
  const profile = usePlayerProfile(shared.player);
  const name = usePlayerDisplayName(shared.player) ?? "";
  const { marks, more } = shownTrail(shared.trail);
  return (
    <div ref={cardRef} className="day-card" data-cut={cut} style={CARD_CUTS[cut]}>
      <div className="day-card__top">
        <img className="day-card__lockup" src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} />
        <b className="day-card__day">
          {DAY} {shared.day}
        </b>
      </div>
      <div className="day-card__who">
        <span className="day-card__portrait">
          <img src={playerPortraitUrl(shared.player, profile.portrait)} alt={name} />
        </span>
        <span className="day-card__name">{name}</span>
        {shared.rank && (
          <span className="day-card__rank">
            <b>#{shared.rank.to}</b>
            {rankMove(shared.rank) && (
              <span data-move={shared.rank.to < shared.rank.from ? "up" : "down"}>{rankMove(shared.rank)}</span>
            )}
            <small>{DAY_SHARE_WORDS.rank}</small>
          </span>
        )}
      </div>
      <div className="day-card__trail" aria-label={DAY_SHARE_WORDS.trail}>
        <small>{DAY_SHARE_WORDS.trail}</small>
        <span className="day-card__marks">
          {marks.length === 0 ? (
            <span className="day-card__quiet">{DAY_SHARE_WORDS.quiet}</span>
          ) : (
            marks.map((mark, index) => (
              <span key={index} className="day-card__mark" data-mark={mark} title={DAY_MARKS[mark].word}>
                <Icon name={DAY_MARKS[mark].icon} size={ICONS[cut].mark} />
              </span>
            ))
          )}
          {more > 0 && <b className="day-card__more">{DAY_SHARE_WORDS.more(more)}</b>}
        </span>
      </div>
      <div className="day-card__totals">
        {dayTotalCells(shared.totals).map((cell) => (
          <span key={cell.icon} className="day-card__total">
            <Icon name={cell.icon} size={ICONS[cut].total} />
            <b>{cell.value}</b>
            <small>{cell.name}</small>
          </span>
        ))}
      </div>
      <div className="day-card__foot">
        <span>{window.location.host}</span>
        <span>{DAY_SHARE_WORDS.playFree}</span>
      </div>
    </div>
  );
};
