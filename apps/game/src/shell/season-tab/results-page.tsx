import { formatAmount, formatOrdinal, formatPoints } from "@bibliothecadao/types";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";

import type { GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldFrontierLeaderboardEntry, HeraldLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { usePlayerDisplayName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { buildLandingLeaderboard } from "@/services/leaderboard/landing-leaderboard-service";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import {
  AppButton,
  AppChip,
  AppFigure,
  AppPanel,
  AppPortrait,
  AppRank,
  AppRow,
} from "@/ui/design-system/kit/app-elements";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import {
  CONTINUE,
  RESULT_WORDS,
  SEASON_ENDINGS,
  SEASON_OVER,
  WITHDRAW,
  YOU_PLACED,
  REWARD_WORDS,
  SEASON_WORDS,
  WORDS,
} from "@/ui/design-system/kit/words";
import { boardRows, findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { rosterWalletOf } from "@/runtime/world/directory";

import { gameKeyOf, gameSlotKeyOf } from "../blitz-rows";
import { clockLine } from "@/ui/design-system/kit/clock-chip";
import { entryHref } from "../game-links";
import { isSameStarknetAddress } from "@realms-world/identity";
import { useLayout } from "../frame/layout";
import { backFrom, isOpenedFrom } from "../frame/opened-from";
import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, useDirectory, useLeaderboard, useRealmsPlayer, useRecentResults } from "../herald";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import type { Painting } from "@/ui/design-system/kit/paintings";
import { ageOf } from "../play/ages";
import { gameKey } from "../play/play-board";
import { markResultsSeen } from "../play/seen-results";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useNowSeconds } from "../use-now";
import { environmentLedger } from "../value/ledger";
import { FailureLine } from "../sign-in/failure-line";
import { FrontierRow } from "./frontier-row";
import { gameTitle } from "./history-row";
import { gameOfResults, resultsHref } from "./results-link";
import { type RewardSeat, useSealedChest } from "./reward";
import { RewardPanel } from "./reward-panel";

/** How many of the board's rows a result shows: the top three on a phone, the final top five on desktop. */
const ROWS = { phone: 3, desktop: 5 } as const;

/**
 * A finished game's record: from the directory (ended), the player's history (settled), or every player's recent
 * history, which holds a game the reader had no seat in (a shared Results; qa-app-2 P3-13).
 */
const useFinishedGame = (ref: GameRef | null) => {
  const { data: player } = useRealmsPlayer();
  const directory = useDirectory();
  const history = useRecentResults(50, player);
  const everyone = useRecentResults(50);
  const matches = (game: DirectoryGame) => ref !== null && game.chainId === ref.chainId && game.game_id === ref.gameId;
  return directory.data?.games.find(matches) ?? history.data?.games.find(matches) ?? everyone.data?.games.find(matches);
};

/**
 * A finished game's Results (spec 08; the owner's pick, C · Ledger): the outcome first (a Blitz player's place and
 * points, or the season's ending), the board's first rows with the player's own, and Continue; Share for Blitz, Season
 * for Frontier. Opened from a list it has Back to that list and no Continue; after a match (or from Play) it has no
 * Back. A sealed chest's Open is the page's one gold step, and Continue stands beside it in outline. Opening it marks
 * the result seen on this device.
 */
export const ResultsPage = () => {
  const { id } = useParams();
  const fromList = isOpenedFrom(useLocation());
  const ref = useMemo(() => gameOfResults(id), [id]);
  useEffect(() => {
    if (ref) markResultsSeen(gameKey({ chainId: ref.chainId, game_id: ref.gameId }));
  }, [ref]);
  return ref ? (
    <Result gameRef={ref} fromList={fromList} />
  ) : (
    <ResultsFrame fromList={fromList}>
      <NothingHere />
    </ResultsFrame>
  );
};

/**
 * Back to the list that opened it; after a match, none. The painting is the page's ground on desktop. The page's
 * buttons stand at the head's end on a desktop and in the foot on a phone.
 */
const ResultsFrame = ({
  fromList,
  painting,
  buttons,
  children,
}: {
  fromList: boolean;
  painting?: Painting;
  buttons?: ReactNode;
  children: ReactNode;
}) => {
  const back = backFrom(useLocation(), "/profile");
  const phone = useLayout() === "phone";
  return (
    <PageFrame
      back={fromList ? back : undefined}
      title={WORDS.results}
      aside={phone ? undefined : buttons}
      foot={phone ? buttons : undefined}
      painting={painting}
    >
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
        <AppPanel>
          <ServiceFailure service="results" error={board.error} retry={() => void board.refetch()} />
        </AppPanel>
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

/** The game's map as it ended, opened as a spectator: anyone may scout how a finished game stood. */
const EndMapButton = ({ gameRef }: { gameRef: GameRef }) => (
  <AppButton
    kind="secondary"
    icon="map"
    to={entryHref({ chainId: gameRef.chainId, game_id: gameRef.gameId }, "spectate")}
  >
    {RESULT_WORDS.endMap}
  </AppButton>
);

/**
 * What Share says: the result as this page tells it, "Blitz 02:18 · 1st of 2 · 0 points", or the game alone for a reader
 * who did not play. One story: Share sends this page's own line and its address, never another account of the game.
 */
const shareLine = (game: DirectoryGame | undefined, own: HeraldLeaderboardEntry | undefined, field: number): string =>
  [
    game ? gameTitle(game) : WORDS.results,
    ...(own
      ? [
          `${formatOrdinal(own.rank)} ${SEASON_WORDS.of} ${formatAmount(field)}`,
          formatPoints(Math.round(own.totalPoints)),
        ]
      : []),
  ].join(" · ");

/**
 * Share: this page's line and its address, through the device's share sheet where it has one (a phone), else copied,
 * the button then saying so. A share the player closes is no failure; a sheet the browser refuses falls back to the
 * copy, and a copy the browser refuses shows the line and the address to select, never nothing.
 */
const ShareButton = ({ gameRef, line }: { gameRef: GameRef; line: string }) => {
  const [done, setDone] = useState<"copied" | "shown" | null>(null);
  const url = new URL(resultsHref(gameRef), window.location.origin).href;
  const share = async () => {
    if (navigator.share) {
      const shared = await navigator.share({ title: WORDS.results, text: line, url }).then(
        () => true,
        (error: unknown) => error instanceof DOMException && error.name === "AbortError",
      );
      if (shared) return;
    }
    setDone(
      await (navigator.clipboard?.writeText(`${line} ${url}`) ?? Promise.reject(new Error("no clipboard"))).then(
        () => "copied" as const,
        () => "shown" as const,
      ),
    );
  };
  return (
    <>
      <AppButton kind="quiet" icon="share" onClick={() => void share()}>
        {done === "copied" ? RESULT_WORDS.copied : SEASON_WORDS.share}
      </AppButton>
      {done === "shown" && (
        <output className="basis-full select-all text-app-label text-app-muted">{`${line} ${url}`}</output>
      )}
    </>
  );
};

/** Continue to Play after a match: the step, unless a sealed chest's Open is the page's. */
const ContinueButton = ({ fromList, chestToOpen = false }: { fromList: boolean; chestToOpen?: boolean }) =>
  fromList ? null : (
    <AppButton kind={chestToOpen ? "secondary" : "primary"} icon="play" step={!chestToOpen} to="/">
      {CONTINUE}
    </AppButton>
  );

/**
 * A Blitz's Results (the owner's pick, C · Ledger), on Blitz's painting: the player's outcome (their place, their
 * points), and beside it the chest their seat earned with the rating it moved; under the outcome, the game's board and
 * how the player's points were made. Share and Continue stand at the head's end on a desktop, in the foot on a phone. A
 * reader who did not play sees which game it was and its board.
 */
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
  const layout = useLayout();
  const own = player ? entries.find((entry) => isSameStarknetAddress(entry.address, player)) : undefined;
  const chestToOpen = useSealedChest(game ? rewardSeatOf(game) : null);
  const top = entries.slice(0, ROWS[layout]);
  const rows = own && !top.includes(own) ? [...top, own] : top;
  const buttons = (
    <span className="flex flex-wrap gap-2">
      <ShareButton gameRef={gameRef} line={shareLine(game, own, entries.length)} />
      <EndMapButton gameRef={gameRef} />
      <ContinueButton fromList={fromList} chestToOpen={chestToOpen} />
    </span>
  );
  const reward = game && <GameReward game={game} />;
  return (
    <ResultsFrame fromList={fromList} painting="blitz-aftermath" buttons={buttons}>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <AppPanel className="lg:col-span-8">
          {own ? (
            <BlitzOutcome own={own} field={entries.length} game={game} gameRef={gameRef} />
          ) : (
            <div className="flex flex-col gap-2">
              <GameLine game={game} gameRef={gameRef} />
              {player && <p className="text-app-body text-app-ink">{RESULT_WORDS.noSeat}</p>}
            </div>
          )}
        </AppPanel>
        {reward && <div className="flex flex-col gap-6 lg:col-span-4 lg:row-span-2">{reward}</div>}
        <AppPanel title={RESULT_WORDS.theGame} icon="leaderboard" flush className="lg:col-span-4">
          <ol>
            {rows.map((entry) => (
              <li key={entry.address}>
                <AppRow
                  own={entry === own}
                  lead={<AppRank rank={entry.rank} />}
                  title={<PlayerName account={entry.address} you={entry === own} portrait />}
                  trail={<AppChip icon="star">{formatPoints(Math.round(entry.totalPoints))}</AppChip>}
                />
              </li>
            ))}
          </ol>
        </AppPanel>
        {own && (
          <AppPanel title={RESULT_WORDS.yourPoints} icon="star" flush className="lg:col-span-4">
            <PointsBreakdown own={own} />
          </AppPanel>
        )}
      </div>
    </ResultsFrame>
  );
};

/** The player's outcome: their portrait, the game, their place of the field and their points. */
const BlitzOutcome = ({
  own,
  field,
  game,
  gameRef,
}: {
  own: HeraldLeaderboardEntry;
  field: number;
  game: DirectoryGame | undefined;
  gameRef: GameRef;
}) => (
  <div className="flex flex-wrap items-center gap-8">
    <PlayerPortrait account={own.address} />
    <div className="flex flex-col gap-3">
      <GameLine game={game} gameRef={gameRef} />
      <span className="text-app-display text-app-ink">{`${formatOrdinal(own.rank)} ${SEASON_WORDS.of} ${formatAmount(field)}`}</span>
      <AppFigure icon="star" tone="gold" value={formatPoints(Math.round(own.totalPoints))} />
    </div>
  </div>
);

/** A player's portrait, large: their chosen one, else their account's, named by the one name rule. */
const PlayerPortrait = ({ account }: { account: string }) => {
  const profile = usePlayerProfile(account);
  const name = usePlayerDisplayName(account)!;
  return <AppPortrait src={playerPortraitUrl(account, profile.portrait)} name={name} size="lg" own />;
};

/** How the player's points were made, a row per kind with its icon, its count and its points; kinds with none left out. */
const PointsBreakdown = ({ own }: { own: HeraldLeaderboardEntry }) => {
  const entry = buildLandingLeaderboard([own])[0];
  const kinds = [
    { icon: "explore", word: RESULT_WORDS.tiles, count: entry.exploredTiles, points: entry.exploredTilePoints },
    { icon: "chest", word: RESULT_WORDS.crates, count: entry.relicCratesOpened, points: entry.relicCratePoints },
    // Herald counts rifts and camps as one: one row, as the share card draws it.
    { icon: "rift", word: RESULT_WORDS.riftsAndCamps, count: entry.riftsTaken, points: entry.riftPoints },
    {
      icon: "hyperstructure",
      word: RESULT_WORDS.hyperstructuresTaken,
      count: entry.hyperstructuresConquered,
      points: entry.hyperstructurePoints,
    },
    {
      icon: "crown",
      word: RESULT_WORDS.hyperstructuresHeld,
      count: entry.hyperstructuresHeld ?? undefined,
      points: entry.hyperstructuresHeldPoints,
    },
  ] as const;
  const scored = kinds.filter((kind) => (kind.points ?? 0) > 0);
  // None scored: the panel says so, never an empty plate (qa-app-1 P3-11).
  if (scored.length === 0) return <p className="px-4 py-3 text-app-body text-app-muted">{RESULT_WORDS.noPoints}</p>;
  return (
    <div>
      {scored.map((kind) => (
        <AppRow
          key={kind.word}
          lead={<SemanticIcon name={kind.icon} size={28} />}
          title={kind.word}
          detail={kind.count ? `× ${formatAmount(kind.count)}` : undefined}
          trail={<AppChip icon="star">{formatPoints(kind.points ?? 0)}</AppChip>}
        />
      ))}
    </div>
  );
};

/** Which game it was, and when it ended; a game no list the page reads still holds, by its number. */
const GameLine = ({ game, gameRef }: { game: DirectoryGame | undefined; gameRef: GameRef }) => {
  const now = useNowSeconds();
  return (
    <p className="text-app-label text-app-age">
      {game
        ? `${gameTitle(game)} · ${clockLine(null, game.clock.end_at, now)}`
        : RESULT_WORDS.blitzGame(gameRef.gameId)}
    </p>
  );
};

/**
 * A season's Results, on the mist lifted: the season's ending and the player's place of the field with what their
 * realm made, then the board's first rows with their own. Season and Withdraw (the realm's LORDS still to take, from the
 * season's last card) stand at the head's end.
 */
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
  const own = findOwnEntry(entries, player);
  const rows = boardRows(entries, player, ROWS[useLayout()]);
  const frontier = ageOf("frontier");
  const buttons = (
    <span className="flex flex-wrap gap-2">
      <AppButton kind="secondary" icon="leaderboard" to="/season">
        {WORDS.season}
      </AppButton>
      <EndMapButton gameRef={gameRef} />
      {/* The player's own ended season stays in reach: its last card holds the realm's LORDS still to withdraw. */}
      {own && (
        <AppButton
          kind="secondary"
          icon="lords"
          to={entryHref({ chainId: gameRef.chainId, game_id: gameRef.gameId }, "play")}
        >
          {WITHDRAW}
        </AppButton>
      )}
      <ContinueButton fromList={fromList} />
    </span>
  );
  return (
    // The season's ending is not yet a recorded fact: the mist lifted stands until Herald names it.
    <ResultsFrame fromList={fromList} painting={ageOf("eternum").painting} buttons={buttons}>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <AppPanel className="lg:col-span-8">
          <div className="flex flex-col gap-4">
            <span className="text-app-display text-app-ink">{SEASON_OVER}</span>
            <p className="text-app-strong text-app-gold">{SEASON_ENDINGS.lifted}</p>
            {own && (
              <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
                <AppFigure
                  icon="leaderboard"
                  tone="gold"
                  value={`#${formatAmount(own.rank)}`}
                  label={`${YOU_PLACED} · ${SEASON_WORDS.of} ${formatAmount(entries.length)}`}
                />
                <AppFigure icon="lords" tone="gold" value={formatAmount(wholeLords(own.rewards.lords))} label="LORDS" />
              </div>
            )}
            {own && (
              <div className="flex flex-wrap gap-2">
                <AppChip icon="explore">{`${formatAmount(own.sites_cleared.total)} · ${RESULT_WORDS.sitesCleared}`}</AppChip>
                <AppChip icon="reward-chest">{`${formatAmount(own.chests_earned)} · ${RESULT_WORDS.chests}`}</AppChip>
                <AppChip icon="portal">{`${formatAmount(own.deepest_depth)} · ${RESULT_WORDS.deepest}`}</AppChip>
              </div>
            )}
          </div>
        </AppPanel>
        <div data-age="frontier" className="lg:col-span-4">
          <AppPanel title={frontier.name} icon="leaderboard" painting={frontier.painting} flush>
            {rows.map(({ entry, own: isOwn }) => (
              <FrontierRow key={entry.address} entry={entry} own={isOwn} />
            ))}
          </AppPanel>
        </div>
      </div>
    </ResultsFrame>
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
