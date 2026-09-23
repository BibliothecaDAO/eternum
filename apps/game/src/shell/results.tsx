import { lazy, Suspense, useState } from "react";

import type { ReviewedGame } from "@/ui/features/game-review/game-review-modal";

import { formatDate } from "./format";
import { modeLabel } from "./game-links";
import { type DirectoryGame, finishedGames, useDirectory, useRealmsPlayer } from "./herald";
import { ErrorPanel, GhostButton, Loading, Panel, PanelTitle } from "./kit";
import { Standings } from "./standings";

/** The post-game review with its award and share cards; heavy, so it loads only when a player opens a score. */
const GameReviewModal = lazy(() =>
  import("@/ui/features/game-review/game-review-modal").then((module) => ({ default: module.GameReviewModal })),
);

const reviewedGame = (game: DirectoryGame): ReviewedGame => ({
  chainId: game.chainId,
  gameId: game.game_id,
  name: game.name,
});

/** Recorded results, newest first: rank and victory points as the chain settled them. */
export const ResultsPage = () => {
  const player = useRealmsPlayer();
  const directory = useDirectory();
  const [openId, setOpenId] = useState<number | null>(null);
  const [review, setReview] = useState<ReviewedGame | null>(null);

  if (directory.isError)
    return (
      <ErrorPanel
        message="Results are unavailable right now."
        error={directory.error}
        retry={() => void directory.refetch()}
      />
    );
  if (directory.isPending) return <Loading />;
  const games = finishedGames(directory.data.games);
  const expanded = openId ?? games[0]?.game_id ?? null;
  return (
    <Panel className="max-w-[880px]">
      <PanelTitle>Results</PanelTitle>
      {games.length === 0 ? <p className="text-sm text-gold/60">No game has settled yet.</p> : null}
      {games.map((game) => (
        <details
          key={`${game.chainId}:${game.game_id}`}
          open={game.game_id === expanded}
          onToggle={(event) => {
            if (event.currentTarget.open) setOpenId(game.game_id);
          }}
          className="border-t border-gold/10 py-2 first:border-t-0"
        >
          <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-[13.5px]">
            <b className="text-gold">{game.name}</b>
            <span className="text-gold/60">
              {modeLabel(game)} · {game.player_count} players · {formatDate(game.clock.end_at)}
            </span>
          </summary>
          {game.game_id === expanded ? (
            <div className="space-y-3 pt-2">
              <Standings game={{ chainId: game.chainId, gameId: game.game_id }} highlight={player} />
              {game.mode === "blitz" ? (
                <GhostButton onClick={() => setReview(reviewedGame(game))}>See score</GhostButton>
              ) : null}
            </div>
          ) : null}
        </details>
      ))}
      {review ? (
        <Suspense fallback={<Loading />}>
          <GameReviewModal isOpen world={review} nextGame={null} onClose={() => setReview(null)} />
        </Suspense>
      ) : null}
    </Panel>
  );
};
