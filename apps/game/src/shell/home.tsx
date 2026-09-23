import { Link } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";

import { formatCountdown } from "./format";
import { EnterLink, GameClock, GameRow, SpectateLink, modeLabel } from "./game-links";
import { type DirectoryGame, finishedGames, isMember, nextOpenGame, useDirectory, useRealmsPlayer } from "./herald";
import { ErrorPanel, Loading, Panel, PanelTitle, Pill } from "./kit";
import { useNowSeconds } from "./use-now";
import { Standings } from "./standings";

const CTA =
  "inline-flex items-center justify-center rounded-lg px-6 py-3 font-cinzel text-[13px] font-semibold uppercase tracking-[0.1em]";

const Landing = ({ next, now }: { next: DirectoryGame | undefined; now: number }) => (
  <div className="relative overflow-hidden rounded-2xl border border-gold/20">
    <img
      src="/images/covers/shell-home.webp"
      alt=""
      className="absolute inset-0 h-full w-full object-cover object-[70%_28%]"
    />
    <div className="absolute inset-0 bg-gradient-to-r from-brown via-brown/80 to-brown/30" />
    <div className="relative max-w-[640px] px-6 py-12 sm:px-10 sm:py-16">
      <p className="font-serif text-[15px] italic text-gold/70">One realm rises. The rest are written into history.</p>
      <h1 className="my-3 font-cinzel text-4xl font-bold uppercase leading-tight tracking-wide text-gold sm:text-6xl">
        Conquer the Realms
      </h1>
      <p className="mb-6 max-w-[54ch] text-[15px] text-gold/85">
        Fully onchain strategy. Raise a realm in the Frontier, or take the field against up to twenty-three rivals in a
        one-hour Blitz. Every march and every crown is on the chain, forever.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/play" className={`${CTA} border border-gold/60 bg-gold text-brown hover:brightness-110`}>
          {next ? `Next game in ${formatCountdown(next.clock.start_main_at - now)}` : "See the games"}
        </Link>
        <Link to="/results" className={`${CTA} border border-gold/40 text-gold hover:bg-gold/10`}>
          Results
        </Link>
      </div>
    </div>
  </div>
);

const MyGames = ({ games, now }: { games: DirectoryGame[]; now: number }) => (
  <Panel>
    <PanelTitle>Your games</PanelTitle>
    {games.length === 0 ? (
      <p className="text-sm text-gold/70">
        You are not in a game yet.{" "}
        <Link to="/play" className="underline">
          Register for the next one.
        </Link>
      </p>
    ) : (
      games.map((game) => (
        <div
          key={`${game.chainId}:${game.game_id}`}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/10 py-3 first:border-t-0"
        >
          <div>
            <div className="font-semibold text-gold">{game.name}</div>
            <div className="text-[12px] text-gold/60">
              {modeLabel(game)} · <GameClock game={game} now={now} />
            </div>
          </div>
          <div className="flex gap-2">
            {game.status === "Live" && game.ready ? <EnterLink game={game} /> : <SpectateLink game={game} />}
          </div>
        </div>
      ))
    )}
  </Panel>
);

const Dashboard = ({ games, now }: { games: DirectoryGame[]; now: number }) => {
  const next = nextOpenGame(games);
  const mine = games.filter(isMember);
  const latest = finishedGames(games)[0];
  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold/60">
            {next ? `Next game · ${modeLabel(next)}` : "No game open"}
          </div>
          <h1 className="my-1 font-cinzel text-3xl font-bold uppercase tracking-wide text-gold sm:text-5xl">
            {next ? next.name : "The realms rest"}
          </h1>
          <Link to="/play" className={`${CTA} mt-2 border border-gold/60 bg-gold text-brown hover:brightness-110`}>
            {next ? "View lobby" : "Open the lobby"}
          </Link>
        </div>
        {next ? (
          <div className="text-right">
            <span className="font-mono text-[32px] font-semibold tabular-nums text-gold">
              {formatCountdown(next.clock.start_main_at - now)}
            </span>
            <small className="block font-mono text-[9.5px] tracking-[0.2em] text-gold/60">
              UNTIL START · {next.registration?.count ?? next.player_count}/{next.registration?.max ?? "—"} SEATED
            </small>
          </div>
        ) : null}
      </Panel>
      <MyGames games={mine} now={now} />
      {latest ? (
        <Panel>
          <PanelTitle>Latest result</PanelTitle>
          <div className="mb-2 flex items-center gap-3">
            <GameRow game={latest} selected={false} onSelect={() => {}} />
          </div>
          <Standings game={{ chainId: latest.chainId, gameId: latest.game_id }} />
        </Panel>
      ) : null}
    </div>
  );
};

export const HomePage = () => {
  const { status } = useIdentitySession();
  const player = useRealmsPlayer();
  const now = useNowSeconds();
  const directory = useDirectory(player);

  if (directory.isError)
    return (
      <ErrorPanel
        message="Games are unavailable right now."
        error={directory.error}
        retry={() => void directory.refetch()}
      />
    );
  if (directory.isPending || status === "loading") return <Loading />;
  const games = directory.data.games;
  if (status === "signed-in") return <Dashboard games={games} now={now} />;
  return (
    <div className="space-y-4">
      <Landing next={nextOpenGame(games)} now={now} />
      <Panel>
        <PanelTitle>Modes</PanelTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            title="Frontier"
            pill="free · season"
            text="A season-long expedition. Every day, a fresh region for your realm."
          />
          <ModeCard
            title="Blitz"
            pill="free · one hour"
            text="Up to 24 players. Registration opens daily at 11:00 and 20:00 UTC."
          />
        </div>
      </Panel>
    </div>
  );
};

const ModeCard = ({ title, pill, text }: { title: string; pill: string; text: string }) => (
  <Link
    to="/play"
    className="flex flex-col gap-2 rounded-lg border border-gold/20 bg-black/40 p-4 hover:border-gold/50"
  >
    <div className="flex items-center justify-between">
      <b className="font-cinzel text-xl uppercase tracking-wide text-gold">{title}</b>
      <Pill tone="open">{pill.toUpperCase()}</Pill>
    </div>
    <small className="text-[12.5px] text-gold/70">{text}</small>
  </Link>
);
