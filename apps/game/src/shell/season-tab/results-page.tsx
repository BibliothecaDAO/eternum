import { formatAmount, formatOrdinal, formatPoints } from "@bibliothecadao/types";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";

import type { GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldFrontierLeaderboard, HeraldLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { usePlayerDisplayName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { buildLandingLeaderboard } from "@/services/leaderboard/landing-leaderboard-service";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import {
  AppBoard,
  type AppBoardEntry,
  AppButton,
  AppChip,
  AppFigure,
  AppPanel,
  AppPortrait,
  AppRank,
  AppRow,
} from "@/ui/design-system/kit/app-elements";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { CONTINUE, RESULT_WORDS, WITHDRAW, REWARD_WORDS, SEASON_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";

import { rosterWalletOf } from "@/runtime/world/directory";

import { gameKeyOf, gameSlotKeyOf } from "../blitz-rows";
import { clockLine } from "@/ui/design-system/kit/clock-chip";
import { entryHref } from "../game-links";
import { isSameStarknetAddress } from "@realms-world/identity";
import { useLayout } from "../frame/layout";
import { isOpenedFrom } from "../frame/opened-from";
import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, useLeaderboard, useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import type { Painting } from "@/ui/design-system/kit/paintings";
import { gameKey } from "../play/play-board";
import { markResultsSeen } from "../play/seen-results";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useNowSeconds } from "../use-now";
import { environmentLedger } from "../value/ledger";
import { FailureLine } from "../sign-in/failure-line";
import { gameTitle } from "./history-row";
import { gameOfResults, resultsHref } from "./results-link";
import { archivedSeason } from "./archive/archive";
import { type RewardSeat, useSealedChest } from "./reward";
import { RewardPanel } from "./reward-panel";
import { useFinishedGame } from "./finished-game";
import { SeasonRecap } from "./season-recap";

/** How many rows tall a result's board stands, by layout: every place is on it, the rest a scroll away. */
const BOARD_ROWS = { phone: 3, desktop: 5 } as const;

/**
 * A finished game's Results (spec 08; the owner's pick, C · Ledger): the outcome first (a Blitz player's place and
 * points, or the season's ending), the board with every place and the player's own lit, and Continue; Share for Blitz,
 * Season for Frontier. Opened from a list it has no Continue (its place, lit, leads back to the list); after a match
 * (or from Play) it has Continue. A sealed chest's Open is the page's one gold step, and Continue stands beside it in
 * outline. Opening it marks the result seen on this device.
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
    <ResultsFrame>
      <NothingHere />
    </ResultsFrame>
  );
};

/**
 * The page's frame: no Back, the place it was opened from lit. The painting is the page's ground on desktop. The page's
 * buttons stand at the head's end on a desktop and in the foot on a phone.
 */
const ResultsFrame = ({
  painting,
  buttons,
  children,
}: {
  painting?: Painting;
  buttons?: ReactNode;
  children: ReactNode;
}) => {
  const phone = useLayout() === "phone";
  return (
    <PageFrame
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
      <ResultsFrame>
        <AppPanel>
          <ServiceFailure service="results" error={board.error} retry={() => void board.refetch()} />
        </AppPanel>
      </ResultsFrame>
    );
  if (board.isPending)
    return (
      <ResultsFrame>
        <Loading />
      </ResultsFrame>
    );
  return board.data.mode === "frontier" ? (
    <FrontierResult gameRef={gameRef} game={game} board={board.data} player={player} fromList={fromList} />
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

/** Continue to Play after a match: the page's step, unless another verb leads (a sealed chest's Open, Share my season). */
const ContinueButton = ({ fromList, leads = true }: { fromList: boolean; leads?: boolean }) =>
  fromList ? null : (
    <AppButton kind={leads ? "primary" : "secondary"} icon="play" step={leads} to="/">
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
  const buttons = (
    <span className="flex flex-wrap gap-2">
      <ShareButton gameRef={gameRef} line={shareLine(game, own, entries.length)} />
      <EndMapButton gameRef={gameRef} />
      <ContinueButton fromList={fromList} leads={!chestToOpen} />
    </span>
  );
  const reward = game && <GameReward game={game} />;
  return (
    <ResultsFrame painting="blitz-aftermath" buttons={buttons}>
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
          <AppBoard rows={BOARD_ROWS[layout]} entries={entries.map((entry) => pointsEntry(entry, entry === own))} />
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

/** A player on a Blitz's board: their place, their name and their points. */
const pointsEntry = (entry: HeraldLeaderboardEntry, own: boolean): AppBoardEntry => ({
  key: entry.address,
  own,
  lead: <AppRank rank={entry.rank} />,
  name: <PlayerName account={entry.address} you={own} portrait />,
  figures: [{ icon: "star", value: formatPoints(Math.round(entry.totalPoints)) }],
});

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
 * A season's Results: the season's recap (SeasonRecap), the one drawing of a season's end the game shows too, with
 * Season, the end map and Withdraw (the realm's LORDS still to take, from the season's last card) before its Share; an
 * archived season has no shard to open, so neither of the last two.
 */
const FrontierResult = ({
  gameRef,
  game,
  board,
  player,
  fromList,
}: {
  gameRef: GameRef;
  game: DirectoryGame | undefined;
  board: HeraldFrontierLeaderboard;
  player: string | null;
  fromList: boolean;
}) => {
  const own = findOwnEntry(board.entries, player);
  const onShard = archivedSeason(gameRef) === undefined;
  const actions = (
    <>
      <AppButton kind="secondary" icon="leaderboard" to="/season">
        {WORDS.season}
      </AppButton>
      {onShard && <EndMapButton gameRef={gameRef} />}
      {/* The player's own ended season stays in reach: its last card holds the realm's LORDS still to withdraw. */}
      {onShard && own && (
        <AppButton
          kind="secondary"
          icon="lords"
          to={entryHref({ chainId: gameRef.chainId, game_id: gameRef.gameId }, "play")}
        >
          {WITHDRAW}
        </AppButton>
      )}
      <ContinueButton fromList={fromList} leads={own === undefined} />
    </>
  );
  return (
    // The season's ending is not yet a recorded fact: the mist lifted stands until Herald names it.
    <ResultsFrame painting="season-citadel">
      <SeasonRecap gameRef={gameRef} game={game} board={board} viewer={player} ending="lifted" actions={actions} />
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
