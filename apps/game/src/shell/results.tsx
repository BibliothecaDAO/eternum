import { lazy, Suspense, useState } from "react";

import type { ReviewedGame } from "@/ui/features/game-review/game-review-modal";

import { formatDate } from "./format";
import { modeLabel } from "./game-links";
import { type DirectoryGame, useDirectory, useHistory, useRealmsPlayer } from "./herald";
import { ErrorPanel, GhostButton, Loading, Panel, PanelTitle } from "./kit";
import { Standings } from "./standings";

/** The post-game review with its award and share cards; heavy, so it loads only when a player opens a score. */
const GameReviewModal = lazy(() =>
  import("@/ui/features/game-review/game-review-modal").then((module) => ({ default: module.GameReviewModal })),
);

type Filter = "all" | "mine";

const gameKey = (game: DirectoryGame) => `${game.chainId}:${game.game_id}`;

const reviewedGame = (game: DirectoryGame): ReviewedGame => ({
  chainId: game.chainId,
  gameId: game.game_id,
  name: game.name,
});

/** Recorded results, newest first: rank and victory points as the chain settled them. */
export const ResultsPage = () => {
  const player = useRealmsPlayer();
  const [filter, setFilter] = useState<Filter>("all");
  const mine = filter === "mine" && player !== null;
  const history = useHistory(mine ? player : null);
  const pasted = useDirectory().data?.pastedFinished ?? [];
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewedGame | null>(null);

  const games = history.data?.pages.flatMap((page) => page.games) ?? [];
  const unavailable = [...new Set(history.data?.pages.flatMap((page) => page.failures.map(({ url }) => url)) ?? [])];
  const expanded = openKey ?? (games[0] ? gameKey(games[0]) : null);
  const row = (game: DirectoryGame) => (
    <ResultRow
      key={gameKey(game)}
      game={game}
      open={gameKey(game) === expanded}
      onOpen={() => setOpenKey(gameKey(game))}
      highlight={player}
      onReview={() => setReview(reviewedGame(game))}
    />
  );

  return (
    <Panel className="max-w-[880px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>Results</PanelTitle>
        {player ? <FilterButtons filter={filter} onChange={setFilter} /> : null}
      </div>
      {history.isError ? (
        <ErrorPanel
          message="Results are unavailable right now."
          error={history.error}
          retry={() => void history.refetch()}
        />
      ) : null}
      {history.isPending ? <Loading /> : null}
      {history.isSuccess && games.length === 0 ? (
        <p className="text-sm text-gold/60">{mine ? "You have no finished game yet." : "No game has settled yet."}</p>
      ) : null}
      {games.map(row)}
      {unavailable.map((url) => (
        <p key={url} className="border-t border-gold/10 py-2 text-[12.5px] text-gold/60">
          Results from {new URL(url).host} are unavailable right now.
        </p>
      ))}
      {history.hasNextPage ? (
        <div className="pt-3">
          <GhostButton onClick={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>
            {history.isFetchingNextPage ? "Loading…" : "Load more"}
          </GhostButton>
        </div>
      ) : null}
      {!mine && pasted.length > 0 ? (
        <div className="mt-4">
          <PanelTitle>From shards you opened</PanelTitle>
          {pasted.map(row)}
        </div>
      ) : null}
      {review ? (
        <Suspense fallback={<Loading />}>
          <GameReviewModal isOpen world={review} nextGame={null} onClose={() => setReview(null)} />
        </Suspense>
      ) : null}
    </Panel>
  );
};

const FilterButtons = ({ filter, onChange }: { filter: Filter; onChange: (filter: Filter) => void }) => (
  <div className="flex gap-2" role="group" aria-label="Filter results">
    {(["all", "mine"] as const).map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        aria-pressed={filter === option}
        className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] ${
          filter === option ? "border-gold/60 bg-gold/15 text-gold" : "border-gold/20 text-gold/60 hover:text-gold"
        }`}
      >
        {option === "all" ? "All games" : "My games"}
      </button>
    ))}
  </div>
);

const ResultRow = ({
  game,
  open,
  onOpen,
  highlight,
  onReview,
}: {
  game: DirectoryGame;
  open: boolean;
  onOpen: () => void;
  highlight: string | null;
  onReview: () => void;
}) => (
  <details
    open={open}
    onToggle={(event) => {
      if (event.currentTarget.open) onOpen();
    }}
    className="border-t border-gold/10 py-2 first:border-t-0"
  >
    <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-[13.5px]">
      <b className="text-gold">{game.name}</b>
      <span className="text-gold/60">
        {modeLabel(game)} · {game.player_count} players · {formatDate(game.clock.end_at)}
      </span>
    </summary>
    {open ? (
      <div className="space-y-3 pt-2">
        <Standings game={{ chainId: game.chainId, gameId: game.game_id }} highlight={highlight} />
        {game.mode === "blitz" ? <GhostButton onClick={onReview}>See score</GhostButton> : null}
      </div>
    ) : null}
  </details>
);
