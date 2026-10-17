import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import type { GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldFrontierLeaderboardEntry, HeraldLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { buildLandingLeaderboard } from "@/services/leaderboard/landing-leaderboard-service";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { CONTINUE, SEASON_ENDINGS, SEASON_OVER, WITHDRAW, YOU_PLACED } from "@/ui/design-system/kit/words";
import { boardRows, findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { rosterWalletOf } from "@/runtime/world/directory";

import { gameKeyOf, gameSlotKeyOf } from "../blitz-rows";
import { clockLine } from "../clock-chip";
import { entryHref } from "../game-links";
import { formatPoints } from "../format";
import { isSameStarknetAddress } from "@realms-world/identity";
import { useLayout } from "../frame/layout";
import { backFrom, isOpenedFrom, openedFrom } from "../frame/opened-from";
import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, useDirectory, useLeaderboard, useRealmsPlayer, useRecentResults } from "../herald";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import type { Painting } from "../paintings";
import { ageOf } from "../play/ages";
import { gameKey } from "../play/play-board";
import { markResultsSeen } from "../play/seen-results";
import { FailureCard } from "../play/state-card";
import { useNowSeconds } from "../use-now";
import { environmentLedger } from "../value/ledger";
import { FailureLine } from "../sign-in/failure-line";
import { REWARD_WORDS, SEASON_WORDS, WORDS } from "../words";
import { gameTitle } from "./history-row";
import { gameOfResults } from "./results-link";
import { type RewardSeat, useSealedChest } from "./reward";
import { RewardPanel } from "./reward-panel";

/** The post-game score and share cards; heavy, so they load only when a player taps Share. */
const GameReviewModal = lazy(() =>
  import("@/ui/features/game-review/game-review-modal").then((module) => ({ default: module.GameReviewModal })),
);

/** The game's score card, the one the review shows and shares; it draws a large SVG, so it loads with the page's data. */
const ScoreCardContent = lazy(() =>
  import("@/ui/features/game-review/score-card-content").then((module) => ({ default: module.ScoreCardContent })),
);

/** How many of the board's rows a result shows: the top three on a phone, the final top five on desktop. */
const ROWS = { phone: 3, desktop: 5 } as const;

/** A finished game's record, from the directory (ended) or the player's history (settled), when either holds it. */
const useFinishedGame = (ref: GameRef | null) => {
  const { data: player } = useRealmsPlayer();
  const directory = useDirectory();
  const history = useRecentResults(50, player);
  const matches = (game: DirectoryGame) => ref !== null && game.chainId === ref.chainId && game.game_id === ref.gameId;
  return directory.data?.games.find(matches) ?? history.data?.games.find(matches);
};

/**
 * A finished game's Results (spec 08): the outcome first, at the top (a Blitz player's score card, the one the game's
 * review shares; or the season's ending), the board's first rows with the player's own, and Continue; Share for
 * Blitz, Season for Frontier. Opened from a list it
 * has Back to that list and no Continue; after a match (or from Play) it has no Back. A sealed chest's Open is the
 * page's one gold step, and Continue stands beside it in outline. Opening it marks the result seen on this device.
 */
export const ResultsPage = () => {
  const { id } = useParams();
  const fromList = isOpenedFrom(useLocation());
  const ref = gameOfResults(id);
  useEffect(() => {
    if (ref) markResultsSeen(gameKey({ chainId: ref.chainId, game_id: ref.gameId }));
  }, [ref?.chainId, ref?.gameId]);
  return ref ? (
    <Result gameRef={ref} fromList={fromList} />
  ) : (
    <ResultsFrame fromList={fromList}>
      <NothingHere />
    </ResultsFrame>
  );
};

/** Back to the list that opened it; after a match, none. The painting is the page's ground on desktop. */
const ResultsFrame = ({
  fromList,
  painting,
  foot,
  children,
}: {
  fromList: boolean;
  painting?: Painting;
  foot?: ReactNode;
  children: ReactNode;
}) => {
  const back = backFrom(useLocation(), "/profile");
  return (
    <PageFrame back={fromList ? back : undefined} title={WORDS.results} painting={painting} foot={foot}>
      {children}
    </PageFrame>
  );
};

const Result = ({ gameRef, fromList }: { gameRef: GameRef; fromList: boolean }) => {
  const board = useLeaderboard(gameRef);
  const game = useFinishedGame(gameRef);
  const { data: player } = useRealmsPlayer();
  if (board.isError)
    return (
      <ResultsFrame fromList={fromList}>
        <FailureCard service="results" error={board.error} retry={() => void board.refetch()} />
      </ResultsFrame>
    );
  if (board.isPending)
    return (
      <ResultsFrame fromList={fromList}>
        <Loading />
      </ResultsFrame>
    );
  return board.data.mode === "frontier" ? (
    <FrontierResult gameRef={gameRef} entries={board.data.entries} player={player} fromList={fromList} />
  ) : (
    <BlitzResult gameRef={gameRef} game={game} entries={board.data.entries} player={player} fromList={fromList} />
  );
};

/**
 * The outcome at the top with the board's rows: on a phone one column, the outcome above the rows; on desktop the
 * outcome and its buttons at the left, the rows at the right, over the painting as the page's ground.
 */
const ResultLayout = ({
  painting,
  outcome,
  rows,
  buttons,
  fromList,
}: {
  painting: Painting;
  outcome: ReactNode;
  rows: ReactNode;
  buttons: ReactNode;
  fromList: boolean;
}) =>
  useLayout() === "phone" ? (
    <ResultsFrame fromList={fromList} foot={buttons}>
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-1">{outcome}</section>
        {rows}
      </div>
    </ResultsFrame>
  ) : (
    <ResultsFrame fromList={fromList} painting={painting}>
      <div className="grid grid-cols-[1fr_28rem] items-start gap-8">
        <section className="flex flex-col gap-1">
          {outcome}
          <div className="pt-4">{buttons}</div>
        </section>
        {rows}
      </div>
    </ResultsFrame>
  );

/** The place, large in gold: "You placed #12 of 1,240". */
const Placed = ({ lead, place, field }: { lead?: string; place: string; field: number }) => (
  <p className="flex items-baseline gap-2 font-body text-base font-semibold text-kit-cream">
    {lead}
    <b className="text-figure font-extrabold leading-none text-kit-gold">{place}</b>
    <span className="text-kit-muted">
      {SEASON_WORDS.of} {formatAmount(field)}
    </span>
  </p>
);

/** Continue to Play after a match: the gold step, unless a sealed chest's Open is the page's. */
const Buttons = ({
  fromList,
  chestToOpen = false,
  children,
}: {
  fromList: boolean;
  chestToOpen?: boolean;
  children: ReactNode;
}) => {
  const navigate = useNavigate();
  return (
    <div className="flex gap-2">
      {!fromList && (
        <Button
          role={chestToOpen ? "secondary" : "primary"}
          word={CONTINUE}
          icon="play"
          className="flex-1"
          onClick={() => navigate("/")}
        />
      )}
      {children}
    </div>
  );
};

const BlitzResult = ({
  gameRef,
  game,
  entries,
  player,
  fromList,
}: {
  gameRef: GameRef;
  game: DirectoryGame | undefined;
  entries: HeraldLeaderboardEntry[];
  player: string | null;
  fromList: boolean;
}) => {
  const [sharing, setSharing] = useState(false);
  const layout = useLayout();
  const own = player ? entries.find((entry) => isSameStarknetAddress(entry.address, player)) : undefined;
  const chestToOpen = useSealedChest(game ? rewardSeatOf(game) : null);
  const top = entries.slice(0, ROWS[layout]);
  const rows = own && !top.includes(own) ? [...top, own] : top;
  return (
    <ResultLayout
      painting={ageOf("blitz").painting}
      fromList={fromList}
      outcome={own ? <ScoreCard own={own} game={game} /> : <GameLine game={game} />}
      rows={
        <div className="flex flex-col gap-5">
          <ol className="plate px-2">
            {rows.map((entry) => {
              const isOwn = entry === own;
              return (
                <li
                  key={entry.address}
                  className="flex h-[52px] items-center gap-2 border-b border-kit-line px-1 last:border-b-0"
                >
                  <span className="w-[34px] text-center text-base tabular-nums">{entry.rank}</span>
                  <span className="min-w-0 flex-1 text-base">
                    <PlayerName account={entry.address} you={isOwn} portrait />
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {formatPoints(entry.totalPoints)} {SEASON_WORDS.vp}
                  </span>
                </li>
              );
            })}
          </ol>
          {game && <GameReward game={game} />}
        </div>
      }
      buttons={
        <Buttons fromList={fromList} chestToOpen={chestToOpen}>
          <Button
            role="secondary"
            word={SEASON_WORDS.share}
            icon="share"
            className="flex-1"
            onClick={() => setSharing(true)}
          />
          {sharing && (
            <Suspense fallback={null}>
              <GameReviewModal
                isOpen
                world={{ chainId: gameRef.chainId, gameId: gameRef.gameId, name: game?.name ?? "" }}
                nextGame={null}
                onClose={() => setSharing(false)}
              />
            </Suspense>
          )}
        </Buttons>
      }
    />
  );
};

/**
 * The player's score card, as the game's review draws it, stacked for a portrait phone; sharing it is the page's Share
 * (the review's landscape image), so the card has no buttons.
 */
const ScoreCard = ({ own, game }: { own: HeraldLeaderboardEntry; game: DirectoryGame | undefined }) => {
  const layout = useLayout() === "phone" ? "portrait" : "landscape";
  return (
    <Suspense fallback={<Loading />}>
      <ScoreCardContent
        worldName={game?.name ?? ""}
        playerEntry={buildLandingLeaderboard([own])[0]}
        showActions={false}
        layout={layout}
      />
    </Suspense>
  );
};

/** A reader who did not play it: which game, and when it ended. */
const GameLine = ({ game }: { game: DirectoryGame | undefined }) => {
  const now = useNowSeconds();
  return (
    <p className="text-base text-kit-muted">
      {game ? `${gameTitle(game)} · ${clockLine(null, game.clock.end_at, now)}` : "—"}
    </p>
  );
};

const FrontierResult = ({
  gameRef,
  entries,
  player,
  fromList,
}: {
  gameRef: GameRef;
  entries: HeraldFrontierLeaderboardEntry[];
  player: string | null;
  fromList: boolean;
}) => {
  const navigate = useNavigate();
  const here = useLocation();
  const own = findOwnEntry(entries, player);
  const rows = boardRows(entries, player, ROWS[useLayout()]);
  return (
    <ResultLayout
      // The season's ending is not yet a recorded fact: the mist lifted stands until Herald names it.
      painting={ageOf("eternum").painting}
      fromList={fromList}
      outcome={
        <>
          <p className="font-display text-hero leading-tight text-kit-cream lg:text-display">{SEASON_OVER}</p>
          <p className="font-body text-base font-bold text-kit-gold2">{SEASON_ENDINGS.lifted}</p>
          {own && <Placed lead={YOU_PLACED} place={`#${own.rank}`} field={entries.length} />}
          {own && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Chip icons={["flag"]} value={formatAmount(own.sites_cleared.total)} label="Sites cleared" />
              <Chip icons={["chest"]} value={formatAmount(own.chests_earned)} label="Chests" />
              <Chip icons={["lords"]} value={formatAmount(wholeLords(own.rewards.lords))} label="LORDS" />
              <Chip icons={["portal"]} value={formatAmount(own.deepest_depth)} label="Deepest" />
            </div>
          )}
        </>
      }
      rows={
        <section className="plate px-2">
          {rows.map(({ entry, own: isOwn }) => (
            <SeasonRow
              key={entry.address}
              rank={entry.rank}
              order={entry.order}
              name={<PlayerName account={entry.address} you={isOwn} portrait />}
              sitesCleared={entry.sites_cleared.total}
              lords={wholeLords(entry.rewards.lords)}
              own={isOwn}
              onOpen={() => navigate(`/p/${entry.address}`, { state: openedFrom(here) })}
            />
          ))}
        </section>
      }
      buttons={
        <Buttons fromList={fromList}>
          <Button
            role="secondary"
            word={WORDS.season}
            icon="victory"
            className="flex-1"
            onClick={() => navigate("/season")}
          />
          {/* The player's own ended season stays in reach: its last card holds the realm's LORDS still to withdraw. */}
          {own && (
            <Button
              role="secondary"
              word={WITHDRAW}
              icon="lords"
              className="flex-1"
              onClick={() => navigate(entryHref({ chainId: gameRef.chainId, game_id: gameRef.gameId }, "play"))}
            />
          )}
        </Buttons>
      }
    />
  );
};

/**
 * Under a paid Blitz's board: the rating change and chest of the player's seat, read on the environment's ledger by
 * the game's key, for the wallet the shard's roster froze for the player. Nothing for a game outside a slot or a
 * player off its roster; a ledger not deployed on this environment is said so.
 */
const GameReward = ({ game }: { game: DirectoryGame }) => {
  if (!gameSlotKeyOf(game) || !rosterWalletOf(game)) return null;
  const seat = rewardSeatOf(game);
  if (!seat) return <FailureLine line={REWARD_WORDS.unreadable} />;
  return <RewardPanel ledger={seat.ledger} keys={seat.keys} owner={seat.owner} />;
};

/** The seat a paid Blitz rewards, on this environment's ledger; null outside a slot, off its roster, or with no ledger. */
const rewardSeatOf = (game: DirectoryGame): RewardSeat | null => {
  const slot = gameSlotKeyOf(game);
  const owner = rosterWalletOf(game);
  const ledger = environmentLedger();
  return slot && owner && ledger ? { ledger, keys: { game: gameKeyOf(game), slot }, owner } : null;
};
