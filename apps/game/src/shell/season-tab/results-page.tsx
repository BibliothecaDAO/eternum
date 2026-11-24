import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";

import type { GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { AppButton, AppPanel } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { CONTINUE, RESULT_WORDS, WITHDRAW, WORDS } from "@/ui/design-system/kit/words";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";

import { entryHref } from "../game-links";
import { useLayout } from "../frame/layout";
import { isOpenedFrom } from "../frame/opened-from";
import { PageFrame } from "../frame/page-frame";
import { type AspectSeasonGame, type DirectoryGame, isAspectSeason, useLeaderboard, useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { NothingHere } from "../not-found";
import type { Painting } from "@/ui/design-system/kit/paintings";
import { gameKey } from "../play/play-board";
import { markResultsSeen } from "../play/seen-results";
import { seasonRealm } from "../season-pick";
import { archivedSeason } from "./archive/archive";
import { useFinishedGame } from "./finished-game";
import { gameOfResults } from "./results-link";
import { SeasonRaceRecap, SeasonRecap } from "./season-recap";

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
  if (game !== null && game.mode !== "frontier") {
    return (
      <ResultsFrame>
        <NothingHere />
      </ResultsFrame>
    );
  }
  if (game !== null && isAspectSeason(game)) {
    return <AspectSeasonResult gameRef={gameRef} game={game} fromList={fromList} />;
  }
  return <SeasonResult gameRef={gameRef} game={game} fromList={fromList} />;
};

const AspectSeasonResult = ({
  gameRef,
  game,
  fromList,
}: {
  gameRef: GameRef;
  game: AspectSeasonGame;
  fromList: boolean;
}) => {
  const onShard = archivedSeason(gameRef) === undefined;
  const hasRealm = seasonRealm(game) !== undefined;
  const actions = (
    <>
      <AppButton kind="secondary" icon="leaderboard" to="/season">
        {WORDS.season}
      </AppButton>
      {onShard && <EndMapButton gameRef={gameRef} />}
      {onShard && hasRealm && <WithdrawButton gameRef={gameRef} />}
      <ContinueButton fromList={fromList} leads />
    </>
  );
  return (
    <ResultsFrame painting="season-citadel">
      <SeasonRaceRecap game={game} ending="lifted" actions={actions} />
    </ResultsFrame>
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
  if (board.data === null)
    return (
      <ResultsFrame>
        <NothingHere />
      </ResultsFrame>
    );
  return <FrontierResult gameRef={gameRef} game={game} board={board.data} player={player} fromList={fromList} />;
};

const EndMapButton = ({ gameRef }: { gameRef: GameRef }) => (
  <AppButton
    kind="secondary"
    icon="map"
    to={entryHref({ chainId: gameRef.chainId, game_id: gameRef.gameId }, "spectate")}
  >
    {RESULT_WORDS.endMap}
  </AppButton>
);

const ContinueButton = ({ fromList, leads = true }: { fromList: boolean; leads?: boolean }) =>
  fromList ? null : (
    <AppButton kind={leads ? "primary" : "secondary"} icon="play" step={leads} to="/">
      {CONTINUE}
    </AppButton>
  );

const WithdrawButton = ({ gameRef }: { gameRef: GameRef }) => (
  <AppButton
    kind="secondary"
    icon="lords"
    to={entryHref({ chainId: gameRef.chainId, game_id: gameRef.gameId }, "play")}
  >
    {WITHDRAW}
  </AppButton>
);

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
      {onShard && own && <WithdrawButton gameRef={gameRef} />}
      <ContinueButton fromList={fromList} leads={own === undefined} />
    </>
  );
  return (
    <ResultsFrame painting="season-citadel">
      <SeasonRecap gameRef={gameRef} game={game} board={board} viewer={player} ending="lifted" actions={actions} />
    </ResultsFrame>
  );
};
