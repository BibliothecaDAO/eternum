import "@/ui/design-system/kit/app-sheet.css";
import "./season-recap.css";

import { formatAmount, formatExact, formatShort, LORDS } from "@bibliothecadao/types";
import type { HeraldFrontierLeaderboard, HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import type { GameRef } from "@bibliothecadao/eternum/shard";
import { isSameStarknetAddress } from "@realms-world/identity";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { usePlayerDisplayName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppButton, AppGameName, AppPortrait } from "@/ui/design-system/kit/app-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import {
  DEPTH_NUMERALS,
  ESSENCE,
  PRIZE_UNHELD,
  RECAP_WORDS,
  RESULT_WORDS,
  SEASON_ENDINGS,
} from "@/ui/design-system/kit/words";
import { SITE_COUNTS, SITE_KINDS } from "@/ui/features/frontier/board/season-detail";
import { type PodiumHolder, seasonPodium } from "@/ui/features/frontier/board/season-pool";
import { earnedResource, findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";
import { TARGET_MARKS } from "@/ui/features/frontier/sites/site-marks";

import { useLayout } from "../frame/layout";
import type { DirectoryGame } from "../herald";
import { ageOf } from "../play/ages";
import { seasonEnded, seasonTitle } from "../season";
import { FailureLine } from "../sign-in/failure-line";
import { resultsHref } from "./results-link";
import { shareSeasonCard, type SharedCard } from "./share-card";

type Entry = HeraldFrontierLeaderboardEntry;

/** The card's two cuts, each at the size it is exported: X's and Discord's feed (16:9), a phone's feed and story (4:5). */
const CUTS = { wide: { width: 1200, height: 675 }, tall: { width: 1080, height: 1350 } } as const;
type Cut = keyof typeof CUTS;

/**
 * A Frontier season's end, wherever it is read (the owner's pick C, 1 November 2026: "the card is the screen"): the
 * season and how it ended, the player's share card at full size, the podium beside it, and the page's own steps with
 * Share my season last. Share sends the card as it is drawn, so the screen and the image are one drawing: a desktop
 * shares the wide cut, a phone the tall one. In the game it covers the HUD (`cover`); on Results it stands in the page.
 * A reader with no realm on the board sees the season and its podium, and nothing to share.
 */
export const SeasonRecap = ({
  gameRef,
  game,
  board,
  viewer,
  ending,
  actions,
  withdraw,
  cover = false,
}: {
  gameRef: GameRef;
  /** The season as the directory lists it; unknown while the directory loads. */
  game: DirectoryGame | undefined;
  /** Herald's final board; unknown while it loads. */
  board: HeraldFrontierLeaderboard | undefined;
  viewer: string | null;
  ending: keyof typeof SEASON_ENDINGS;
  /** The page's steps, before Share my season. */
  actions: ReactNode;
  /** The realm's LORDS still to withdraw, where the recap covers the way to them. */
  withdraw?: ReactNode;
  cover?: boolean;
}) => {
  const cut: Cut = useLayout() === "phone" ? "tall" : "wide";
  const card = useRef<HTMLDivElement>(null);
  const own = board && findOwnEntry(board.entries, viewer);
  const title = game ? seasonTitle(game) : ageOf("frontier").name;
  return (
    <section
      data-surface="shell"
      aria-label={SEASON_ENDINGS[ending]}
      className="season-recap"
      data-cover={cover || undefined}
      data-cut={cut}
    >
      {cover && <img className="season-recap__painting" alt="" {...paintingSources("season-citadel")} sizes="100vw" />}
      <header className="season-recap__head">
        {game && <p className="text-app-label text-app-gold">{seasonEnded(game)}</p>}
        <h1 className="text-app-display text-app-ink">{SEASON_ENDINGS[ending]}</h1>
      </header>
      {board && own && (
        <CardFrame cut={cut}>
          <SeasonCard
            cardRef={card}
            cut={cut}
            title={title}
            own={own}
            field={board.entries.length}
            prize={prizeOf(board, own)}
          />
        </CardFrame>
      )}
      {board && <RecapPodium board={board} viewer={viewer} />}
      <footer className="season-recap__foot">
        {withdraw}
        <span className="season-recap__steps">
          {actions}
          {board && own && (
            <ShareSeason card={card} cut={cut} line={shareLine(title, own, board.entries.length)} gameRef={gameRef} />
          )}
        </span>
      </footer>
    </section>
  );
};

/** The LORDS a player's place on the podium pays, once a pool is published: the ledger's award, else the place held. */
const prizeOf = (board: HeraldFrontierLeaderboard, entry: Entry): number | undefined =>
  seasonPodium(board)?.find(
    ({ holder }) => typeof holder === "object" && isSameStarknetAddress(holder.address, entry.address),
  )?.lords;

/** What Share says beside the image: "Season 1 · Playtest · #3 of 45 realms". */
const shareLine = (title: string, own: Entry, field: number) =>
  `${title} · #${formatAmount(own.rank)} ${RECAP_WORDS.ofRealms(formatAmount(field))}`;

/**
 * The card drawn at its exported size and scaled to the room it has: the image Share makes is this node as it is, at
 * 1:1, whatever the screen.
 */
const CardFrame = ({ cut, children }: { cut: Cut; children: ReactNode }) => {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setScale(entry!.contentRect.width / CUTS[cut].width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [cut]);
  return (
    <div
      ref={frame}
      className="season-recap__frame"
      style={{ aspectRatio: `${CUTS[cut].width} / ${CUTS[cut].height}` }}
    >
      <div className="season-recap__scaler" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
};

/**
 * The share card: the season, the player's portrait with their Order, their name, their place of the field and the
 * prize it paid, their season in four figures and their sites by kind, Frontier's lockup and where to play.
 */
const SeasonCard = ({
  cardRef,
  cut,
  title,
  own,
  field,
  prize,
}: {
  cardRef: RefObject<HTMLDivElement>;
  cut: Cut;
  title: string;
  own: Entry;
  field: number;
  prize: number | undefined;
}) => {
  const profile = usePlayerProfile(own.address);
  const name = usePlayerDisplayName(own.address)!;
  const frontier = ageOf("frontier");
  return (
    <div ref={cardRef} className="season-card" data-cut={cut} style={CUTS[cut]}>
      <img className="season-card__painting" alt="" {...paintingSources("season-citadel")} sizes="1200px" />
      <div className="season-card__body">
        <div className="season-card__who">
          <AppPortrait src={playerPortraitUrl(own.address, profile.portrait)} name={name} size="fill" own />
          <span className="season-card__order">
            <OrderEmblem order={own.order} size={cut === "wide" ? 96 : 116} />
          </span>
        </div>
        <div className="season-card__facts">
          <span className="season-card__kick">{title}</span>
          <span className="season-card__name">{name}</span>
          <span className="season-card__place">
            <b>#{formatAmount(own.rank)}</b>
            <span>{RECAP_WORDS.ofRealms(formatAmount(field))}</span>
          </span>
          {prize !== undefined && (
            <span className="season-card__prize">
              <Icon name="victory" size={40} />
              {`${RECAP_WORDS.prize} · ${formatExact(prize)} ${LORDS}`}
            </span>
          )}
          <div className="season-card__stats">
            <Figure icon="flag" value={formatShort(own.sites_cleared.total)} label={RESULT_WORDS.sitesCleared} />
            <Figure icon="reward-chest" value={formatShort(own.chests_earned)} label={RESULT_WORDS.chests} />
            <Figure icon="lords" value={formatShort(wholeLords(own.rewards.lords))} label={LORDS} />
            <Figure icon="essence" value={formatShort(earnedResource(own.rewards.essence))} label={ESSENCE} />
          </div>
          <div className="season-card__kinds">
            {SITE_KINDS.map((kind) => (
              <span key={kind} title={TARGET_MARKS[kind].word}>
                <Icon name={TARGET_MARKS[kind].icon} size={46} />
                {formatShort(own.sites_cleared[SITE_COUNTS[kind]])}
              </span>
            ))}
            {own.deepest_depth > 0 && (
              <span title={RESULT_WORDS.deepest}>
                <Icon name="portal" size={46} />
                {DEPTH_NUMERALS[own.deepest_depth - 1]}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="season-card__foot">
        <AppGameName age="frontier" name={frontier.name} />
        <span>{window.location.host}</span>
      </div>
    </div>
  );
};

const Figure = ({ icon, value, label }: { icon: IconMeaning; value: string; label: string }) => (
  <span className="season-card__figure">
    <Icon name={icon} size={54} />
    <span>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  </span>
);

/**
 * The podium: once a pool is published, its prize places as the ledger holds them (seasonPodium: who holds each, or why
 * no one does yet, and its LORDS); before, or in a season with no pool, the board's first three. Each with its sites.
 */
const RecapPodium = ({ board, viewer }: { board: HeraldFrontierLeaderboard; viewer: string | null }) => (
  <section className="season-recap__podium">
    <h2 className="text-app-label text-app-muted">{RECAP_WORDS.podium}</h2>
    <ol>
      {podiumPlaces(board).map(({ place, holder, lords }) => {
        const entry =
          typeof holder === "object"
            ? board.entries.find((each) => isSameStarknetAddress(each.address, holder.address))
            : undefined;
        const own = entry !== undefined && viewer !== null && isSameStarknetAddress(entry.address, viewer);
        return (
          <li key={place} data-own={own || undefined}>
            <b className="text-app-game text-app-gold">{place}</b>
            <span className="min-w-0 flex-1 truncate text-app-heading text-app-ink">
              {typeof holder === "object" ? (
                <PlayerName account={holder.address} you={own} portrait />
              ) : (
                PRIZE_UNHELD[holder]
              )}
            </span>
            {entry && (
              <span className="flex items-center gap-1 text-app-body tabular-nums text-app-ink">
                <Icon name="flag" size={18} />
                {formatAmount(entry.sites_cleared.total)}
              </span>
            )}
            {lords !== undefined && (
              <span className="flex items-center gap-1 text-app-body tabular-nums text-app-gold">
                <Icon name="lords" size={18} />
                {formatExact(lords)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </section>
);

/** The podium's places: the ledger's prize places once a pool is published, else the board's first three. */
const podiumPlaces = (board: HeraldFrontierLeaderboard): { place: number; holder: PodiumHolder; lords?: number }[] =>
  seasonPodium(board) ??
  board.entries.slice(0, 3).map((entry) => ({ place: entry.rank, holder: { address: entry.address } }));

/**
 * Share my season: the card made into an image at its own size, on the press that asks for it, then handed to the
 * device's share sheet with the season's line and its Results (a phone), else saved (a desktop). A sheet the player
 * closes is no failure; an image that cannot be made says so.
 */
const ShareSeason = ({
  card,
  cut,
  line,
  gameRef,
}: {
  card: RefObject<HTMLDivElement>;
  cut: Cut;
  line: string;
  gameRef: GameRef;
}) => {
  const [state, setState] = useState<"idle" | "making" | SharedCard | "failed">("idle");
  const share = async () => {
    if (!card.current) return;
    setState("making");
    const url = new URL(resultsHref(gameRef), window.location.origin).href;
    setState(await shareSeasonCard(card.current, { ...CUTS[cut], line, url }).catch(() => "failed" as const));
  };
  return (
    <>
      <AppButton
        kind="primary"
        icon="share"
        busy={state === "making" ? RECAP_WORDS.making : undefined}
        onClick={() => void share()}
      >
        {state === "saved" ? RECAP_WORDS.saved : RECAP_WORDS.share}
      </AppButton>
      {state === "failed" && <FailureLine line={RECAP_WORDS.failed} />}
    </>
  );
};
