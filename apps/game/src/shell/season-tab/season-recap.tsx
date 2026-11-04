import "@/ui/design-system/kit/app-sheet.css";
import "./season-recap.css";

import { formatAmount, formatExact, formatShort, LORDS } from "@bibliothecadao/types";
import type { HeraldFrontierLeaderboard, HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import type { GameRef } from "@bibliothecadao/eternum/shard";
import { isSameStarknetAddress } from "@realms-world/identity";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

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
  FESTIVAL_WORDS,
  LABOR,
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
import { canCopyCard, copySeasonCard, shareSeasonCard, type SharedCard } from "./share-card";
import { DiyaRow, FestivalLockup, FireworkSky, Rangoli } from "./festival-art";
import { type Festival, FestivalHeading, SeasonTicketStamp, SeasonTicketStrip } from "./festival";

type Entry = HeraldFrontierLeaderboardEntry;

/**
 * The deck's two cuts, each at the size it is exported: the four cards side by side for X's and Discord's feed (16:9),
 * two by two for a phone's feed and story (4:5).
 */
const CUTS = { wide: { width: 1200, height: 675 }, tall: { width: 1080, height: 1350 } } as const;
type Cut = keyof typeof CUTS;

/** The deck's cards, in the order a story steps through them. */
const CARDS = ["place", "podium", "sites", "haul"] as const;
type CardName = (typeof CARDS)[number];

/**
 * A Frontier season's end, wherever it is read (the owner's pick B, 1 November 2026: "four cards wrapped style"): the
 * season and how it ended, the player's four cards (their place, the podium, their sites, their haul), and the page's own
 * steps with Share my season last. The deck is one node, at the size it is shared: a desktop shows it whole, the cards
 * flipping in one after another; a phone steps through it a card at a time, as a story over that same node. Share sends
 * the deck as it is drawn, so the screen and the image are one drawing. In the game it covers the HUD (`cover`); on
 * Results it stands in the page. A reader with no realm on the board sees the season and its podium, and nothing to
 * share.
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
  festival,
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
  /** Season 0's end on Diwali, dressed one of two ways (festival.tsx). */
  festival?: Festival;
}) => {
  const cut: Cut = useLayout() === "phone" ? "tall" : "wide";
  const deck = useRef<HTMLDivElement>(null);
  const { room, deckWidth, layoutStyle, roomStyle } = useDeckFit(cut, cover);
  const own = board && findOwnEntry(board.entries, viewer);
  const title = game ? seasonTitle(game) : ageOf("frontier").name;
  const sky = festival?.look === "sky";
  const festiveDeck = festival?.look === "deck";
  /** The ticket stands beside the season (a desktop) or over the steps (a phone); the deck's look stamps it instead. */
  const ticketStrip = sky && festival.ticket ? <SeasonTicketStrip /> : null;
  /** Beside the season on a desktop stands the ticket, when it has one; the LORDS to withdraw go to the steps. */
  const besideSeason = cut === "wide" ? (ticketStrip ?? withdraw) : null;
  const overSteps =
    cut === "tall" ? (
      <>
        {ticketStrip}
        {withdraw}
      </>
    ) : (
      ticketStrip && withdraw
    );
  const recap = (
    <section
      data-surface="shell"
      aria-label={SEASON_ENDINGS[ending]}
      className="season-recap"
      data-cover={cover || undefined}
      data-cut={cut}
    >
      {cover && <img className="season-recap__painting" alt="" {...paintingSources("season-citadel")} sizes="100vw" />}
      {cover && sky && <FireworkSky className="season-recap__sky" frame={festival.frame} />}
      <div className="season-recap__layout" style={layoutStyle}>
        <header className="season-recap__head">
          {game && <p className="text-app-label text-app-gold">{seasonEnded(game)}</p>}
          {/* A phone's column is too narrow for the ending at display size: it reads at a title's. */}
          {festival ? (
            <FestivalHeading ending={ending} tall={cut === "tall"} />
          ) : (
            <h1 className={cut === "tall" ? "text-app-title text-app-ink" : "text-app-display text-app-ink"}>
              {SEASON_ENDINGS[ending]}
            </h1>
          )}
          {/* A desktop's LORDS to withdraw stand beside the season, so the cards keep the height a row of them takes. */}
          {besideSeason && <div className="season-recap__withdraw">{besideSeason}</div>}
        </header>
        {board &&
          (own ? (
            <div ref={room} className="season-recap__room" style={roomStyle}>
              <DeckFrame cut={cut} width={deckWidth}>
                <Deck deckRef={deck} cut={cut} title={title} festive={festiveDeck}>
                  <PlaceCard
                    own={own}
                    field={board.entries.length}
                    prize={prizeOf(board, own)}
                    ticket={festiveDeck && festival.ticket}
                  />
                  <PodiumCard board={board} viewer={viewer} />
                  <SitesCard own={own} />
                  <HaulCard own={own} />
                </Deck>
              </DeckFrame>
            </div>
          ) : (
            <div className="season-recap__alone">
              <PodiumCard board={board} viewer={viewer} alone />
            </div>
          ))}
        <footer className="season-recap__foot">
          {overSteps}
          <span className="season-recap__steps">
            {actions}
            {board && own && (
              <ShareSeason card={deck} cut={cut} line={shareLine(title, own, board.entries.length)} gameRef={gameRef} />
            )}
          </span>
        </footer>
      </div>
    </section>
  );
  // Over the HUD it is drawn at the body's end: inside the desktop HUD it would take the HUD's zoom, and its words
  // would read smaller than the app draws them.
  return cover ? createPortal(recap, document.body) : recap;
};

/** The LORDS a player's place on the podium pays, once a pool is published: the ledger's award, else the place held. */
export const prizeOf = (board: HeraldFrontierLeaderboard, entry: Entry): number | undefined =>
  seasonPodium(board)?.find(
    ({ holder }) => typeof holder === "object" && isSameStarknetAddress(holder.address, entry.address),
  )?.lords;

/** What Share says beside the image: "Playtest · #3 of 45 realms". */
const shareLine = (title: string, own: Entry, field: number) =>
  `${title} · #${formatAmount(own.rank)} ${RECAP_WORDS.ofRealms(formatAmount(field))}`;

/**
 * The deck's room, measured for the scale that fits the deck to it: the room is whichever element the ref callback is
 * given, and a room replaced is let go and the new one measured.
 */
const useRoomSize = () => {
  const [room, setRoom] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState<RoomSize | null>(null);
  useLayoutEffect(() => {
    if (!room || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry!.contentRect.width, height: entry!.contentRect.height }),
    );
    observer.observe(room);
    return () => observer.disconnect();
  }, [room]);
  return [setRoom, size] as const;
};

type RoomSize = { width: number; height: number };

/**
 * The least the deck is drawn at, of its own size: its smallest words (19 px in the deck) still read at the app's
 * smallest text, 14 px. A room shorter than the deck at this scale scrolls instead.
 */
const MIN_DECK_SCALE = 14 / 19;

/**
 * How wide the four cards stand on a desktop: the room's width, and over the HUD (`cover`, the screen's whole height
 * the recap's) no taller than the room left between the season and the steps, so the whole recap stands on one screen.
 */
const wideDeckWidth = (room: RoomSize, cover: boolean) => {
  if (!cover) return room.width;
  const height = Math.max(room.height, MIN_DECK_SCALE * CUTS.wide.height);
  return Math.min(room.width, (height * CUTS.wide.width) / CUTS.wide.height);
};

/** The wide deck's width, which the season above it and the steps under it share. */
const deckWidthStyle = (width: number): CSSProperties & Record<"--deck-width", string> => ({
  "--deck-width": `${width}px`,
});

/**
 * The deck fitted to its room: the story's frame as wide as the room on a phone; the four cards as wide as
 * `wideDeckWidth` lets them on a desktop, the season and the steps as wide as they are, and over the HUD a room never
 * shorter than the deck at its least size, so a shorter screen scrolls.
 */
const useDeckFit = (cut: Cut, cover: boolean) => {
  const [room, size] = useRoomSize();
  const wide = cut === "wide";
  const deckWidth = size && (wide ? wideDeckWidth(size, cover) : size.width);
  return {
    room,
    deckWidth,
    layoutStyle: wide && deckWidth ? deckWidthStyle(deckWidth) : undefined,
    roomStyle: wide && cover ? { minHeight: MIN_DECK_SCALE * CUTS.wide.height } : undefined,
  };
};

/**
 * The deck drawn at its exported size and fitted to the room it has, so the image Share makes is this node as it is, at
 * 1:1. A desktop sees it whole. A phone sees one card at a time over the same node, as a story: a strip of four marks
 * on top, the next card on a tap at the right or a swipe left, the one before on a tap at the left or a swipe right.
 */
const DeckFrame = ({ cut, width, children }: { cut: Cut; width: number | null | undefined; children: ReactNode }) => {
  const [shown, setShown] = useState(0);
  const swipeFrom = useRef(0);
  /** A press that travelled far enough was a swipe: the pointer's click it ends in steps no further. */
  const swiped = useRef(false);
  const step = (by: number) => setShown((at) => Math.min(CARDS.length - 1, Math.max(0, at + by)));
  /**
   * A half pressed: a key's press (a click no pointer made, `detail` 0) always steps; a pointer's steps unless it ends
   * the swipe just made. A touch swipe ends in no click, so its mark waits for the next pointer's, never a key's.
   */
  const tap = (by: number, click: MouseEvent) => {
    const endsSwipe = click.detail > 0 && swiped.current;
    if (click.detail > 0) swiped.current = false;
    if (!endsSwipe) step(by);
  };
  if (cut === "wide")
    return (
      <div
        className="season-recap__frame"
        style={{ width: width ?? undefined, aspectRatio: `${CUTS.wide.width} / ${CUTS.wide.height}` }}
      >
        <div
          className="season-recap__scaler"
          style={{ transform: `scale(${(width ?? CUTS.wide.width) / CUTS.wide.width})` }}
        >
          {children}
        </div>
      </div>
    );
  const card = TALL_CARD;
  const scale = (width ?? card.width) / card.width;
  const { left, top } = tallCardAt(shown);
  return (
    <div className="season-recap__story">
      <ol className="season-recap__ticks" aria-label={RECAP_WORDS.cards}>
        {CARDS.map((name, index) => (
          <li key={name} data-on={index <= shown || undefined} aria-current={index === shown ? "step" : undefined} />
        ))}
      </ol>
      <div
        className="season-recap__frame"
        data-card={CARDS[shown]}
        style={{ aspectRatio: `${card.width} / ${card.height}` }}
        onPointerDown={(event) => {
          swipeFrom.current = event.clientX;
          swiped.current = false;
        }}
        onPointerUp={(event) => {
          const moved = event.clientX - swipeFrom.current;
          swiped.current = Math.abs(moved) > SWIPE;
          if (swiped.current) step(moved < 0 ? 1 : -1);
        }}
      >
        <div className="season-recap__scaler" style={{ transform: `scale(${scale}) translate(${-left}px, ${-top}px)` }}>
          {children}
        </div>
        <button
          type="button"
          className="season-recap__back"
          aria-label={RECAP_WORDS.previous}
          onClick={(event) => tap(-1, event)}
        />
        <button
          type="button"
          className="season-recap__next"
          aria-label={RECAP_WORDS.next}
          onClick={(event) => tap(1, event)}
        />
      </div>
    </div>
  );
};

/** How far a press must travel across the story to count as a swipe, in pixels. */
const SWIPE = 40;

/** Each cut's layout, in the deck's own pixels: its margin, the gap between its cards and above its foot, its foot. */
const LAYOUTS = { wide: { pad: 24, gap: 16, foot: 64 }, tall: { pad: 40, gap: 30, foot: 110 } } as const;
const TALL = LAYOUTS.tall;
/** A tall card's size, two by two over the cut: the story's view is one card. */
const TALL_CARD = {
  width: (CUTS.tall.width - 2 * TALL.pad - TALL.gap) / 2,
  height: (CUTS.tall.height - 2 * TALL.pad - TALL.foot - 2 * TALL.gap) / 2,
};
/** Where a card stands in the tall cut, two by two: the story's view moves there. */
const tallCardAt = (index: number) => ({
  left: TALL.pad + (index % 2) * (TALL_CARD.width + TALL.gap),
  top: TALL.pad + Math.floor(index / 2) * (TALL_CARD.height + TALL.gap),
});

/**
 * The deck, the node Share makes into an image: the four cards, then a foot with Frontier's lockup, the season and
 * where to play. Its size is the cut's; the cards fill it, so none stands half empty.
 */
const Deck = ({
  deckRef,
  cut,
  title,
  festive,
  children,
}: {
  deckRef: RefObject<HTMLDivElement>;
  cut: Cut;
  title: string;
  /**
   * Dressed for Diwali: still fireworks over a wide deck (it is an image), a rangoli in each card's corner, diyas and
   * both hosts in its foot.
   */
  festive: boolean;
  children: ReactNode;
}) => (
  <div ref={deckRef} className="season-deck" data-cut={cut} data-festive={festive || undefined} style={deckStyle(cut)}>
    {/* Only the wide cut has sky over its cards' heads; a tall card fills its top. */}
    {festive && cut === "wide" && <FireworkSky className="season-deck__sky" bursts={4} frame={2.2} />}
    <div className="season-deck__cards">{children}</div>
    <div className="season-deck__foot">
      <AppGameName age="frontier" name={ageOf("frontier").name} />
      {festive ? (
        <span className="season-deck__greeting">
          <DiyaRow count={2} size={cut === "tall" ? 56 : 40} />
          {`${FESTIVAL_WORDS.diwali} · ${title}`}
          <DiyaRow count={2} size={cut === "tall" ? 56 : 40} />
        </span>
      ) : (
        <span>{title}</span>
      )}
      {festive ? <FestivalLockup height={cut === "tall" ? 44 : 30} /> : <span>{window.location.host}</span>}
    </div>
  </div>
);

/** The deck's size and layout, as the stylesheet reads them (season-recap.css). */
const deckStyle = (cut: Cut): CSSProperties & Record<`--deck-${string}`, string> => ({
  ...CUTS[cut],
  "--deck-pad": `${LAYOUTS[cut].pad}px`,
  "--deck-gap": `${LAYOUTS[cut].gap}px`,
  "--deck-foot": `${LAYOUTS[cut].foot}px`,
});

/** One card: its number in the deck and its name at the top (its name alone, outside the deck), what it holds under. */
const Card = ({ name, alone = false, children }: { name: CardName; alone?: boolean; children: ReactNode }) => (
  <article className="season-card" data-card={name}>
    <Rangoli size={150} className="season-card__rangoli" />
    <span className="season-card__step">
      {alone ? RECAP_WORDS.cardNames[name] : `${CARDS.indexOf(name) + 1} · ${RECAP_WORDS.cardNames[name]}`}
    </span>
    {children}
  </article>
);

/** Your place: your portrait with your Order, your place of the field, your name (whole, however long), your prize. */
const PlaceCard = ({
  own,
  field,
  prize,
  ticket,
}: {
  own: Entry;
  field: number;
  prize: number | undefined;
  ticket: boolean;
}) => {
  const profile = usePlayerProfile(own.address);
  const name = usePlayerDisplayName(own.address)!;
  return (
    <Card name="place">
      {ticket && <SeasonTicketStamp />}
      <span className="season-card__who">
        <AppPortrait src={playerPortraitUrl(own.address, profile.portrait)} name={name} size="fill" own />
        <span className="season-card__order">
          <OrderEmblem order={own.order} size={56} />
        </span>
      </span>
      <b className="season-card__rank">#{formatAmount(own.rank)}</b>
      <span className="season-card__of">{RECAP_WORDS.ofRealms(formatAmount(field))}</span>
      <span className="season-card__name">{name}</span>
      {prize !== undefined && (
        <span className="season-card__prize">
          <Icon name="victory" size={30} />
          {`${RECAP_WORDS.prize} · ${formatExact(prize)} ${LORDS}`}
        </span>
      )}
    </Card>
  );
};

/**
 * The podium: once a pool is published, its prize places as the ledger holds them (seasonPodium: who holds each, or why
 * no one does yet, and its LORDS); before, or in a season with no pool, the board's first three. Each with its sites,
 * under who took the season.
 */
const PodiumCard = ({
  board,
  viewer,
  alone = false,
}: {
  board: HeraldFrontierLeaderboard;
  viewer: string | null;
  alone?: boolean;
}) => {
  const places = podiumPlaces(board);
  const first = places[0]?.holder;
  return (
    <Card name="podium" alone={alone}>
      <h2 className="season-card__title">
        {typeof first === "object" ? (
          <>
            <PlayerName account={first.address} you={isViewer(first.address, viewer)} /> {RECAP_WORDS.tookTheSeason}
          </>
        ) : (
          RECAP_WORDS.podium
        )}
      </h2>
      <ol className="season-card__podium">
        {places.map(({ place, holder, lords }) => {
          const entry =
            typeof holder === "object"
              ? board.entries.find((each) => isSameStarknetAddress(each.address, holder.address))
              : undefined;
          const own = entry !== undefined && isViewer(entry.address, viewer);
          return (
            <li key={place} data-own={own || undefined}>
              <b>{place}</b>
              <span className="season-card__holder">
                {typeof holder === "object" ? (
                  <PlayerName account={holder.address} you={own} portrait />
                ) : (
                  <span className="season-card__unheld">{PRIZE_UNHELD[holder]}</span>
                )}
              </span>
              <span className="season-card__counts">
                {entry && (
                  <span className="season-card__count">
                    <Icon name="flag" size={18} />
                    {formatAmount(entry.sites_cleared.total)}
                  </span>
                )}
                {lords !== undefined && (
                  <span className="season-card__count" data-tone="gold">
                    <Icon name="lords" size={18} />
                    {formatExact(lords)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};

const isViewer = (address: string, viewer: string | null) => viewer !== null && isSameStarknetAddress(address, viewer);

/** The podium's places: the ledger's prize places once a pool is published, else the board's first three. */
const podiumPlaces = (board: HeraldFrontierLeaderboard): { place: number; holder: PodiumHolder; lords?: number }[] =>
  seasonPodium(board) ??
  board.entries.slice(0, 3).map((entry) => ({ place: entry.rank, holder: { address: entry.address } }));

/** Your sites: how many you cleared, then each kind with its painting, and your depth once through the spire. */
const SitesCard = ({ own }: { own: Entry }) => (
  <Card name="sites">
    <b className="season-card__big">{formatShort(own.sites_cleared.total)}</b>
    <span className="season-card__title">{RESULT_WORDS.sitesCleared}</span>
    <div className="season-card__tiles">
      {SITE_KINDS.map((kind) => (
        <Tile
          key={kind}
          icon={TARGET_MARKS[kind].icon}
          value={formatShort(own.sites_cleared[SITE_COUNTS[kind]])}
          label={TARGET_MARKS[kind].word}
        />
      ))}
    </div>
    {own.deepest_depth > 0 && (
      <span className="season-card__depth">
        <Icon name="portal" size={30} />
        {`${RESULT_WORDS.deepest} · ${DEPTH_NUMERALS[own.deepest_depth - 1]}`}
      </span>
    )}
  </Card>
);

/** Your haul: the chests, LORDS, Essence and Labor your realm earned. */
const HaulCard = ({ own }: { own: Entry }) => (
  <Card name="haul">
    <div className="season-card__tiles">
      <Tile icon="reward-chest" value={formatShort(own.chests_earned)} label={RESULT_WORDS.chests} />
      <Tile icon="lords" value={formatShort(wholeLords(own.rewards.lords))} label={LORDS} />
      <Tile icon="essence" value={formatShort(earnedResource(own.rewards.essence))} label={ESSENCE} />
      <Tile icon="labor" value={formatShort(earnedResource(own.rewards.labor))} label={LABOR} />
    </div>
  </Card>
);

const Tile = ({ icon, value, label }: { icon: IconMeaning; value: string; label: string }) => (
  <span className="season-card__tile">
    <Icon name={icon} size={72} />
    <b>{value}</b>
    <small>{label}</small>
  </span>
);

/**
 * Share my season: the deck made into an image at its own size, on the press that asks for it, then handed to the
 * device's share sheet with the season's line and its Results (a phone), else saved (a desktop). Beside it on a desktop
 * whose clipboard takes a PNG, Copy image puts the same image there to paste (the owner, 1 November 2026). A sheet the
 * player closes is no failure; an image that cannot be made says so, under either.
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
  const [state, setState] = useState<"idle" | "making" | "copying" | SharedCard | "copied" | "failed">("idle");
  const send = async (making: "making" | "copying", sent: (node: HTMLElement) => Promise<typeof state>) => {
    if (!card.current) return;
    setState(making);
    setState(await sent(card.current).catch(() => "failed" as const));
  };
  const url = new URL(resultsHref(gameRef), window.location.origin).href;
  return (
    <>
      {cut === "wide" && canCopyCard() && (
        <AppButton
          kind="quiet"
          icon="copy"
          busy={state === "copying" ? RECAP_WORDS.making : undefined}
          onClick={() => void send("copying", (node) => copySeasonCard(node, CUTS[cut]).then(() => "copied" as const))}
        >
          {state === "copied" ? RECAP_WORDS.copied : RECAP_WORDS.copy}
        </AppButton>
      )}
      <AppButton
        kind="primary"
        icon="share"
        busy={state === "making" ? RECAP_WORDS.making : undefined}
        onClick={() => void send("making", (node) => shareSeasonCard(node, { ...CUTS[cut], line, url }))}
      >
        {state === "saved" ? RECAP_WORDS.saved : RECAP_WORDS.share}
      </AppButton>
      {state === "failed" && <FailureLine line={RECAP_WORDS.failed} />}
    </>
  );
};
