import { useSearchParams } from "react-router-dom";

import { useAccountStore } from "@/hooks/store/use-account-store";

import { BlitzSlots } from "./blitz-slots";
import { ShardUrlForm } from "./shard-url-form";
import { formatCountdown, formatLocalTime } from "./format";
import { EnterLink, GameRow, SpectateLink, modeLabel, statusPill } from "./game-links";
import { type DirectoryGame, isGameOver, isMember, nextOpenGame, sameGame, useDirectory } from "./herald";
import { ErrorPanel, Loading, Panel, PanelTitle, Pill, StatBlock } from "./kit";
import { Standings } from "./standings";
import { useNowSeconds } from "./use-now";

const gameRef = (game: DirectoryGame) => ({ chainId: game.chainId, gameId: game.game_id });
const gameKey = (game: DirectoryGame) => `${game.chainId}:${game.game_id}`;

const FrontierSeason = ({ games }: { games: DirectoryGame[] }) => {
  const season = games.find((game) => game.mode === "frontier" && !isGameOver(game));
  if (!season) return null;
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <PanelTitle>Frontier season</PanelTitle>
        <div className="font-cinzel text-2xl font-bold uppercase tracking-wide text-gold">{season.name}</div>
        <p className="text-sm text-gold/70">Free and open all season. A new expedition every day at 00:00 UTC.</p>
      </div>
      {season.ready ? <EnterLink game={season} /> : <Pill tone="open">OPENS SOON</Pill>}
    </Panel>
  );
};

/** The free Blitz flow settles the roster's realms; play opens once every member has theirs. */
const BlitzPreparing = ({ game, member }: { game: DirectoryGame; member: boolean }) => (
  <>
    {member ? "Your realms are being prepared." : "The roster's realms are being prepared."} Play opens once every
    player on the roster has their realms
    {game.roster_count > 0
      ? ` · ${Math.min(game.player_count, game.roster_count)} / ${game.roster_count} players settled`
      : ""}
    .
  </>
);

const GameDetail = ({ game, now, player }: { game: DirectoryGame; now: number; player: string | null }) => {
  const pill = statusPill(game);
  const ended = isGameOver(game);
  const member = isMember(game);
  const canEnter = !ended && game.ready && (member || game.mode === "frontier");
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-cinzel text-2xl font-bold uppercase tracking-wide text-gold">{game.name}</h2>
        <Pill tone={pill.tone}>{pill.label}</Pill>
        <span className="text-[12px] text-gold/60">{modeLabel(game)}</span>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatBlock label="Players" value={String(game.player_count)} />
        <StatBlock
          label={ended ? "Ended" : game.status === "Live" ? "Ends" : "Starts"}
          value={formatLocalTime(ended || game.status === "Live" ? game.clock.end_at : game.clock.start_main_at)}
          sub={
            !ended
              ? formatCountdown((game.status === "Live" ? game.clock.end_at : game.clock.start_main_at) - now)
              : undefined
          }
        />
      </div>
      {!ended && !game.ready ? (
        <p role="status" className="mb-4 text-sm text-gold/80">
          {game.mode === "blitz" ? <BlitzPreparing game={game} member={member} /> : "The season is being prepared."}
        </p>
      ) : null}
      {game.mode === "blitz" && ended && game.status !== "Settled" ? (
        <p role="status" className="mb-4 text-sm text-gold/80">
          Final points are being settled.
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-3">
        {canEnter ? <EnterLink game={game} /> : null}
        <SpectateLink game={game} />
      </div>
      {game.status !== "Created" && game.status !== "Registration" ? (
        <>
          <PanelTitle>{ended ? "Final standings" : "Standings"}</PanelTitle>
          <Standings game={gameRef(game)} highlight={player} />
        </>
      ) : null}
    </Panel>
  );
};

export const PlayPage = () => {
  const [search, setSearch] = useSearchParams();
  const now = useNowSeconds();
  const player = useAccountStore((state) => state.account?.address ?? null);
  const directory = useDirectory(player);
  const games = directory.data?.games ?? [];
  const requested = { chainId: search.get("chain") ?? "", gameId: Number(search.get("game")) };
  const selected = games.find((game) => sameGame(gameRef(game), requested)) ?? nextOpenGame(games) ?? games[0];
  const listed = games.toSorted((a, b) => b.clock.start_main_at - a.clock.start_main_at);

  return (
    <div className="space-y-4">
      <FrontierSeason games={games} />
      <BlitzSlots />
      {directory.isPending ? <Loading /> : null}
      {directory.isError ? (
        <ErrorPanel
          message="Games are unavailable right now."
          error={directory.error}
          retry={() => void directory.refetch()}
        />
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
        <div>
          {listed.map((game) => (
            <GameRow
              key={gameKey(game)}
              game={game}
              selected={selected !== undefined && sameGame(gameRef(game), gameRef(selected))}
              onSelect={() => setSearch({ chain: game.chainId, game: String(game.game_id) })}
            />
          ))}
          {directory.isSuccess && games.length === 0 ? (
            <p className="text-sm text-gold/60">No games on the open shards yet.</p>
          ) : null}
          <div className="mt-4">
            <ShardUrlForm failures={directory.data?.failures ?? []} />
          </div>
        </div>
        {selected ? <GameDetail key={gameKey(selected)} game={selected} now={now} player={player} /> : null}
      </div>
    </div>
  );
};
