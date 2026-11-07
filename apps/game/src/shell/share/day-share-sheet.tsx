import "@/ui/design-system/kit/app-sheet.css";
import "./day-share.css";

import { sharePath, type ShareMoment } from "@realms-world/identity";
import { formatShort } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";

import { identityClient } from "@/hooks/context/identity-session";
import { usePlayerDisplayName, usePlayerName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { CARD_CUTS, cardJpeg, type CardCut } from "@/utils/card-image";

import { useLayout } from "../frame/layout";

import { shareHint, ShareSteps } from "./share-steps";
import { ageOf } from "../play/ages";
import { Icon } from "@/ui/design-system/icon";
import { AppGameName, AppIconButton, AppPortrait } from "@/ui/design-system/kit/app-elements";
import { CLOSE, DAY, DAY_SHARE_WORDS } from "@/ui/design-system/kit/words";

import { dayTotalCells, type DayTotals } from "@/ui/features/frontier/log/day-totals";
import { DAY_MARKS, dayPostText, rankMove, shownTrail, type DayMark } from "@/ui/features/frontier/rollover/day-share";

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
 * Sharing a Frontier day, from the day-done card: the day's card at the size it is shared, fitted to the screen, then
 * the two steps (Copy image, Post on X). A desktop draws the wide cut, a phone the tall one, as the season's recap does;
 * the link always unfurls as the wide cut, which a phone draws out of sight for it. The post's link is the player's own for this day (identity's shared links,
 * made as the sheet opens so Post opens X within the press), which is how a friend it brings is told apart; while it
 * is made, or where it cannot be, the post links the game itself. Over the HUD, at the body's end, as the recap is.
 */
export const DayShareSheet = ({ shared, onClose }: { shared: SharedDay; onClose: () => void }) => {
  const cut: CardCut = useLayout() === "phone" ? "tall" : "wide";
  const size = CARD_CUTS[cut];
  const card = useRef<HTMLDivElement>(null);
  const wideOutOfSight = useRef<HTMLDivElement>(null);
  const [frame, width] = useWidth();
  const link = useShareLink({ kind: "frontier-day", ...shared.game, moment: shared.day });
  // The card is drawn for its unfurl once it says whose day it is, never with the name still being read.
  useCardUnfurl(
    usePlayerName(shared.player)?.state === "waiting" ? undefined : link.code,
    cut === "wide" ? card : wideOutOfSight,
  );
  const game = ageOf("frontier").name;
  return createPortal(
    <section data-surface="shell" className="day-share" aria-label={DAY_SHARE_WORDS.share}>
      <div className="day-share__layout">
        <header className="day-share__head">
          <h1 className="text-app-title text-app-ink">{DAY_SHARE_WORDS.share}</h1>
          <AppIconButton icon="close" label={CLOSE} kind="quiet" onClick={onClose} />
        </header>
        <div
          ref={frame}
          className="day-share__frame"
          data-cut={cut}
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
        >
          <div className="day-share__scaler" style={{ transform: `scale(${(width ?? size.width) / size.width})` }}>
            <DayCard cardRef={card} cut={cut} shared={shared} />
          </div>
        </div>
        {cut === "tall" && (
          <div className="day-share__out-of-sight" aria-hidden>
            <DayCard cardRef={wideOutOfSight} cut="wide" shared={shared} />
          </div>
        )}
        <footer className="day-share__foot">
          <ShareTally />
          <p className="day-share__hint">{shareHint()}</p>
          <span className="day-share__steps">
            <ShareSteps
              card={card}
              size={size}
              fileName={DAY_SHARE_WORDS.fileName(shared.day)}
              line={dayPostText({ ...shared, game })}
              url={link.url}
              icons
              onPost={link.posted}
            />
          </span>
        </footer>
      </div>
    </section>,
    document.body,
  );
};

/**
 * The player's link for the moment, and the record that they posted it. A link is made once per moment by identity, so
 * the sheet opened again gets the same one.
 */
const useShareLink = (moment: ShareMoment) => {
  const made = useQuery({
    queryKey: ["shareLink", moment.kind, moment.chainId, moment.gameId, moment.moment],
    queryFn: () => identityClient.createShare(moment),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  const code = made.data;
  return {
    code,
    url: new URL(code ? sharePath(code) : "/", window.location.origin).href,
    // A post that cannot be recorded is still posted; the tally misses it, the player does not.
    posted: () => void (code && identityClient.sharePosted(code).catch(() => undefined)),
  };
};

/**
 * Once the link is made, its card as the link unfurls it: the sheet draws the card, and the same drawing goes to
 * identity as a JPEG, once per link while the sheet is open. Where it cannot be made or kept, the link unfurls with the
 * game's own preview, and the post itself is untouched.
 */
const useCardUnfurl = (code: string | undefined, card: RefObject<HTMLDivElement>) =>
  useQuery({
    queryKey: ["shareCard", code],
    queryFn: async () => {
      await identityClient.uploadShareCard(code!, await cardJpeg(card.current!, CARD_CUTS.wide));
      return true;
    },
    enabled: code !== undefined && card.current !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });

/** What the player's shared days brought so far (identity's count), said once they brought a visit; nothing before. */
const ShareTally = () => {
  const tally = useQuery({ queryKey: ["shareTally"], queryFn: () => identityClient.shareTally(), retry: false });
  if (!tally.data || tally.data.visits === 0) return null;
  return (
    <p className="day-share__tally">
      {DAY_SHARE_WORDS.brought(formatShort(tally.data.visits), formatShort(tally.data.joined))}
    </p>
  );
};

/** The frame's width as laid out, which the card is scaled to; null until measured. */
const useWidth = () => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
};

/**
 * The day's card, the node the image is made of: Frontier's lockup and the day; the player and their closing rank; the
 * day's trail, its fights and finds in order; its totals; and where to play, free.
 */
const DayCard = ({ cardRef, cut, shared }: { cardRef?: Ref<HTMLDivElement>; cut: CardCut; shared: SharedDay }) => {
  const profile = usePlayerProfile(shared.player);
  const name = usePlayerDisplayName(shared.player) ?? "";
  const { marks, more } = shownTrail(shared.trail);
  return (
    <div ref={cardRef} className="day-card" data-cut={cut} style={CARD_CUTS[cut]}>
      <div className="day-card__top">
        <AppGameName age="frontier" name={ageOf("frontier").name} />
        <b className="day-card__day">
          {DAY} {shared.day}
        </b>
      </div>
      <div className="day-card__who">
        <span className="day-card__portrait">
          <AppPortrait src={playerPortraitUrl(shared.player, profile.portrait)} name={name} size="fill" own />
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
