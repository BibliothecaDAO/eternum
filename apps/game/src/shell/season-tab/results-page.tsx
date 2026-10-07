import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import type { GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { boardRows, findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { clockLine } from "../clock-chip";
import { formatPoints, ordinal, sameAddress } from "../format";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, useDirectory, useLeaderboard, useRealmsPlayer, useRecentResults } from "../herald";
import { Loading } from "../kit";
import { NothingHere } from "../not-found";
import { paintingSources } from "../paintings";
import { ageOf } from "../play/ages";
import { gameKey } from "../play/next-step";
import { markResultsSeen } from "../play/seen-results";
import { StateCard } from "../play/state-card";
import { useNowSeconds } from "../use-now";
import { SEASON_WORDS, WORDS } from "../words";
import { gameTitle } from "./history-row";
import { gameOfResults, isFromList } from "./results-link";

/** The post-game score and share cards; heavy, so they load only when a player taps Share. */
const GameReviewModal = lazy(() =>
  import("@/ui/features/game-review/game-review-modal").then((module) => ({ default: module.GameReviewModal })),
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
 * A finished game's Results (spec 08): the outcome on its painting (a Blitz place, or the season's ending), the
 * board's first rows with the player's own, and Continue; Share for Blitz, Season for Frontier. Opened from a list it
 * has Back and no Continue; after a match it has no Back. Opening it marks the result seen on this device.
 */
export const ResultsPage = () => {
  const { id } = useParams();
  const { search } = useLocation();
  const ref = gameOfResults(id);
  const fromList = isFromList(search);
  useEffect(() => {
    if (ref) markResultsSeen(gameKey({ chainId: ref.chainId, game_id: ref.gameId }));
  }, [ref?.chainId, ref?.gameId]);
  return (
    <PageFrame back={fromList ? "/season" : undefined} title={WORDS.results}>
      {ref ? <Result gameRef={ref} fromList={fromList} /> : <NothingHere />}
    </PageFrame>
  );
};

const Result = ({ gameRef, fromList }: { gameRef: GameRef; fromList: boolean }) => {
  const board = useLeaderboard(gameRef);
  const game = useFinishedGame(gameRef);
  const { data: player } = useRealmsPlayer();
  if (board.isError) return <StateCard service="results" error={board.error} retry={() => void board.refetch()} />;
  if (board.isPending) return <Loading />;
  return board.data.mode === "frontier" ? (
    <FrontierResult entries={board.data.entries} player={player} fromList={fromList} />
  ) : (
    <BlitzResult gameRef={gameRef} game={game} entries={board.data.entries} player={player} fromList={fromList} />
  );
};

/** Painting first on a phone; on desktop the painting with the outcome at the left, the rows at the right. */
const ResultLayout = ({ hero, rows, buttons }: { hero: ReactNode; rows: ReactNode; buttons: ReactNode }) =>
  useLayout() === "phone" ? (
    <div className="flex flex-col gap-4">
      {hero}
      {rows}
      {buttons}
    </div>
  ) : (
    <div className="grid grid-cols-[1fr_28rem] items-start gap-8">
      {hero}
      <div className="flex flex-col gap-4">
        {rows}
        {buttons}
      </div>
    </div>
  );

/** The outcome on its painting: a place, or the season's ending. */
const ResultHero = ({ painting, children }: { painting: string; children: ReactNode }) => (
  <section className="relative isolate flex h-56 flex-col justify-end gap-1 overflow-hidden rounded-2xl border border-kit-line p-4 lg:h-[28rem]">
    <img
      {...paintingSources(painting)}
      sizes="(min-width: 1024px) 50vw, 100vw"
      alt=""
      className="absolute inset-0 -z-10 size-full object-cover"
    />
    <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-kit-ground/20 to-kit-ground/95" />
    {children}
  </section>
);

const Buttons = ({ fromList, children }: { fromList: boolean; children: ReactNode }) => {
  const navigate = useNavigate();
  return (
    <div className="flex gap-2">
      {!fromList && (
        <Button
          role="primary"
          word={SEASON_WORDS.continue}
          icon="Pl"
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
  entries: { address: string; rank: number; totalPoints: number }[];
  player: string | null;
  fromList: boolean;
}) => {
  const now = useNowSeconds();
  const [sharing, setSharing] = useState(false);
  const own = player ? entries.find((entry) => sameAddress(entry.address, player)) : undefined;
  const top = entries.slice(0, ROWS[useLayout()]);
  const rows = own && !top.includes(own) ? [...top, own] : top;
  return (
    <ResultLayout
      hero={
        <ResultHero painting={ageOf("blitz").painting}>
          {own && (
            <p className="font-ui text-[40px] font-extrabold leading-none text-kit-gold">
              {ordinal(own.rank)}{" "}
              <span className="text-[17px] font-semibold text-kit-cream">
                {SEASON_WORDS.of} {formatAmount(entries.length)}
              </span>
            </p>
          )}
          <p className="text-[15px] text-kit-muted">
            {game ? `${gameTitle(game)} · ${clockLine(null, game.clock.end_at, now)}` : "—"}
          </p>
        </ResultHero>
      }
      rows={
        <ol className="rounded-2xl border border-kit-line bg-kit-plate px-2">
          {rows.map((entry) => {
            const isOwn = entry === own;
            return (
              <li
                key={entry.address}
                className="flex h-[52px] items-center gap-2 border-b border-kit-line px-1 last:border-b-0"
              >
                <span className="w-[34px] text-center text-[15px] tabular-nums">{entry.rank}</span>
                <span className="min-w-0 flex-1 text-[15px]">
                  <PlayerName account={entry.address} you={isOwn} portrait />
                </span>
                <span className="text-[15px] font-bold tabular-nums">
                  {formatPoints(entry.totalPoints)} {SEASON_WORDS.vp}
                </span>
              </li>
            );
          })}
        </ol>
      }
      buttons={
        <Buttons fromList={fromList}>
          <Button
            role="secondary"
            word={SEASON_WORDS.share}
            icon="Xs"
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

const FrontierResult = ({
  entries,
  player,
  fromList,
}: {
  entries: HeraldFrontierLeaderboardEntry[];
  player: string | null;
  fromList: boolean;
}) => {
  const navigate = useNavigate();
  const own = findOwnEntry(entries, player);
  const rows = boardRows(entries, player, ROWS[useLayout()]);
  return (
    <ResultLayout
      hero={
        // The season's ending is not yet a recorded fact: the mist lifted stands until Herald names it.
        <ResultHero painting={ageOf("eternum").painting}>
          <p className="font-ui text-[15px] font-bold text-kit-gold2">{WORDS.seasonOver}</p>
          <p className="font-display text-[30px] leading-tight text-kit-cream">{SEASON_WORDS.mistLifted}</p>
          {own && (
            <p className="font-ui text-[17px] text-kit-cream">
              {SEASON_WORDS.youPlaced} <b className="text-[24px] text-kit-gold">#{own.rank}</b> {SEASON_WORDS.of}{" "}
              {formatAmount(entries.length)}
            </p>
          )}
          {own && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Chip icons={["Fl"]} value={formatAmount(own.sites_cleared.total)} label="Sites cleared" />
              <Chip icons={["Ch"]} value={formatAmount(own.chests_earned)} label="Chests" />
              <Chip icons={["Lo"]} value={formatAmount(wholeLords(own.rewards.lords))} label="LORDS" />
              <Chip icons={["Dp"]} value={formatAmount(own.deepest_depth)} label="Deepest" />
            </div>
          )}
        </ResultHero>
      }
      rows={
        <section className="rounded-2xl border border-kit-line bg-kit-plate px-2">
          {rows.map(({ entry, own: isOwn }) => (
            <SeasonRow
              key={entry.address}
              rank={entry.rank}
              order={entry.order}
              name={<PlayerName account={entry.address} you={isOwn} portrait />}
              sitesCleared={entry.sites_cleared.total}
              lords={wholeLords(entry.rewards.lords)}
              own={isOwn}
              onOpen={() => navigate(`/p/${entry.address}`)}
            />
          ))}
        </section>
      }
      buttons={
        <Buttons fromList={fromList}>
          <Button
            role="secondary"
            word={WORDS.season}
            icon="Tp"
            className="flex-1"
            onClick={() => navigate("/season")}
          />
        </Buttons>
      }
    />
  );
};
