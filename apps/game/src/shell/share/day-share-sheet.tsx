import "@/ui/design-system/kit/app-sheet.css";
import "./day-share.css";

import { formatShort } from "@bibliothecadao/types";
import { useEffect, useLayoutEffect, useRef, useState, type Ref, type RefObject } from "react";

import { usePlayerDisplayName, usePlayerName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { CARD_CUTS, canShareCardFile, cardJpeg, type CardCut } from "@/utils/card-image";

import { useLayout } from "../frame/layout";

import { useShareLink, useShareTally } from "./own-shares";
import { shareHint, StepNumber, useShareSteps } from "./share-steps";
import { SystemShare } from "./system-share";
import { ageOf } from "../play/ages";
import { Icon } from "@/ui/design-system/icon";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { HudButton, HudIconButton, HudModalLayer, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { CLOSE, DAY, DAY_SHARE_WORDS, SHARE_WORDS } from "@/ui/design-system/kit/words";

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
 * Sharing a Frontier day, from the day-done card, in the HUD's modal layer: the day's card at the size it is shared,
 * fitted to the screen, then the two steps (Copy image, Post on X). A phone whose share sheet takes images also gets
 * Share above them, to any app (owner, 7 November 2026: the day's card goes past X; the season's recap stays X only). A
 * desktop draws the wide cut, a phone the tall one, as the season's recap does; the link always unfurls as the wide
 * cut, which a phone draws out of sight for it. The post's link is the player's own for this day (identity's shared
 * links, made as the sheet opens so a post opens within the press), with the channel it was posted from; while it is
 * made, or where it cannot be, the post links the game itself. Nothing leaves the device until the player presses a
 * way to post: that press publishes the card the link unfurls as (useCardPublication).
 */
export const DayShareSheet = ({ shared, onClose }: { shared: SharedDay; onClose: () => void }) => {
  const phone = useLayout() === "phone";
  const cut: CardCut = phone ? "tall" : "wide";
  const systemShare = phone && canShareCardFile();
  const size = CARD_CUTS[cut];
  const card = useRef<HTMLDivElement>(null);
  const wideOutOfSight = useRef<HTMLDivElement>(null);
  const [frame, width] = useWidth();
  const link = useShareLink({ kind: "frontier-day", ...shared.game, moment: shared.day });
  // The card is made into an image once it says whose day it is, never with the name still being read.
  const named = usePlayerName(shared.player)?.state !== "waiting";
  const publish = useCardPublication(link, cut === "wide" ? card : wideOutOfSight, named);
  const line = dayPostText({ ...shared, game: ageOf("frontier").name });
  const fileName = DAY_SHARE_WORDS.fileName(shared.day);
  const steps = useShareSteps({
    card,
    size,
    fileName,
    line,
    url: link.url("x"),
    onPost: () => {
      publish();
      link.posted();
    },
  });
  return (
    <HudModalLayer onClose={onClose}>
      <section role="dialog" aria-modal="true" aria-label={DAY_SHARE_WORDS.share} className="day-share">
        <div className="day-share__layout">
          <header className="day-share__head">
            <h1 className="text-hud-display">{DAY_SHARE_WORDS.share}</h1>
            <HudIconButton icon="close" label={CLOSE} kind="quiet" onClick={onClose} />
          </header>
          <div
            ref={frame}
            data-surface="shell"
            className="day-share__frame"
            data-cut={cut}
            style={{ aspectRatio: `${size.width} / ${size.height}` }}
          >
            <div className="day-share__scaler" style={{ transform: `scale(${(width ?? size.width) / size.width})` }}>
              <DayCard cardRef={card} cut={cut} shared={shared} />
            </div>
          </div>
          {cut === "tall" && (
            <div data-surface="shell" className="day-share__out-of-sight" aria-hidden>
              <DayCard cardRef={wideOutOfSight} cut="wide" shared={shared} />
            </div>
          )}
          <footer className="day-share__foot">
            <ShareTally />
            {systemShare && (
              <span className="day-share__system">
                <SystemShare
                  card={card}
                  size={size}
                  fileName={fileName}
                  line={line}
                  url={link.url("system")}
                  ready={named && link.code !== undefined}
                  onPress={publish}
                  onShared={link.posted}
                />
              </span>
            )}
            <p className="day-share__hint text-hud-label text-hud-muted">{shareHint()}</p>
            <span className="day-share__steps">
              <HudButton kind="secondary" icon="copy" busy={steps.making} onClick={steps.take}>
                <StepNumber number={1} />
                {steps.word}
              </HudButton>
              <HudButton kind={systemShare ? "secondary" : "primary"} icon="twitter" onClick={steps.post}>
                <StepNumber number={2} />
                {SHARE_WORDS.post}
              </HudButton>
              {steps.failed && <HudNotice tone="bad" line={SHARE_WORDS.failed} />}
            </span>
          </footer>
        </div>
      </section>
    </HudModalLayer>
  );
};

/**
 * The card the link unfurls as, published by the player's press of a way to post (Post on X, Share) and by nothing
 * else: the wide card is made into a JPEG as soon as it says whose day it is, held by this sheet alone, and handed to
 * identity on the press, so the upload is under way before the post's page opens. Closing the sheet without that
 * press publishes nothing. Once per sheet; a failed upload leaves the game's own preview, and the next press tries
 * again.
 */
const useCardPublication = (link: ReturnType<typeof useShareLink>, card: RefObject<HTMLDivElement>, ready: boolean) => {
  const jpeg = useRef<Promise<Blob> | null>(null);
  const published = useRef(false);
  useEffect(() => {
    if (!ready || !card.current || jpeg.current) return;
    jpeg.current = cardJpeg(card.current, CARD_CUTS.wide);
    jpeg.current.catch(() => {
      jpeg.current = null;
    });
  }, [ready, card]);
  return () => {
    const node = card.current;
    if (!link.code || published.current || !node) return;
    published.current = true;
    const image = (jpeg.current ??= cardJpeg(node, CARD_CUTS.wide));
    image.then(link.publish).catch(() => {
      published.current = false;
      jpeg.current = null;
    });
  };
};

/** What the player's shared days brought so far (identity's count), said once they brought a visit; nothing before. */
const ShareTally = () => {
  const tally = useShareTally();
  if (!tally || tally.visits === 0) return null;
  return (
    <p className="day-share__tally text-hud-label text-hud-gold">
      {DAY_SHARE_WORDS.brought(formatShort(tally.visits), formatShort(tally.joined))}
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
