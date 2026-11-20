import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";

import type { GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { AppButton, AppPanel } from "@/ui/design-system/kit/app-elements";
import { CONTINUE, RESULT_WORDS, WITHDRAW, REWARD_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";

import { rosterWalletOf } from "@/runtime/world/directory";

import { gameKeyOf, gameSlotKeyOf } from "../blitz-rows";
import { clockLine } from "@/ui/design-system/kit/clock-chip";
import { entryHref } from "../game-links";
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
import { gameOfResults } from "./results-link";
import { archivedSeason } from "./archive/archive";
import { type RewardSeat, useSealedChest } from "./reward";
import { RewardPanel } from "./reward-panel";
import { useFinishedGame } from "./finished-game";
import { SeasonRecap } from "./season-recap";

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
  const game = useFinishedGame(gameRef);
  if (game === undefined)
    return (
      <ResultsFrame>
        <Loading />
      </ResultsFrame>
    );
  return game !== null && game.mode !== "frontier" ? (
    <BlitzResult gameRef={gameRef} game={game} fromList={fromList} />
  ) : (
    <SeasonResult gameRef={gameRef} game={game} fromList={fromList} />
  );
};

const SeasonResult = ({
  gameRef,
  game,
  fromList,
}: {
  gameRef: GameRef;
  game: DirectoryGame | null;
  fromList: boolean;
}) => {
  const board = useLeaderboard(gameRef);
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
  return <FrontierResult gameRef={gameRef} game={game} board={board.data} player={player} fromList={fromList} />;
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

/** Continue to Play after a match: the page's step, unless another verb leads (a sealed chest's Open, Share my season). */
const ContinueButton = ({ fromList, leads = true }: { fromList: boolean; leads?: boolean }) =>
  fromList ? null : (
    <AppButton kind={leads ? "primary" : "secondary"} icon="play" step={leads} to="/">
      {CONTINUE}
    </AppButton>
  );

const BlitzResult = ({ gameRef, game, fromList }: { gameRef: GameRef; game: DirectoryGame; fromList: boolean }) => {
  const now = useNowSeconds();
  const chestToOpen = useSealedChest(rewardSeatOf(game));
  const buttons = (
    <span className="flex flex-wrap gap-2">
      <EndMapButton gameRef={gameRef} />
      <ContinueButton fromList={fromList} leads={!chestToOpen} />
    </span>
  );
  return (
    <ResultsFrame painting="blitz-aftermath" buttons={buttons}>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <AppPanel className="lg:col-span-8">
          <p className="text-app-label text-app-age">
            {`${gameTitle(game)} · ${clockLine(null, game.clock.end_at, now)}`}
          </p>
        </AppPanel>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <GameReward game={game} />
        </div>
      </div>
    </ResultsFrame>
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
  game: DirectoryGame | null;
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
