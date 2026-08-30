import { Effect } from "effect";
import { Link } from "@tanstack/react-router";

import { HeraldClient, type DirectoryGame } from "@/services/herald";
import { nextOpenGame } from "@/ui/frame";
import { formatCountdown } from "@/ui/format";
import { useQuery } from "@/ui/hooks";
import { ErrorPanel, Flavor, Loading, Panel, PanelTitle, Pill } from "@/ui/kit";
import { matchHistory } from "@/ui/match-history";
import { MatchList } from "@/ui/match-list";
import { useNowSeconds, useSession } from "@/ui/session";

function Landing({ next, now }: { next: DirectoryGame | undefined; now: number }) {
  return (
    <div className="flex min-h-[70vh] flex-col justify-center">
      <div className="max-w-[660px] py-6">
        <Flavor>One realm rises. The rest are written into history.</Flavor>
        <h1 className="my-2 font-display text-[clamp(56px,8vw,100px)] leading-[0.95] tracking-[0.02em] text-parchment [text-shadow:0_4px_40px_rgba(0,0,0,0.85),0_0_80px_rgba(227,144,1,0.22)]">
          CONQUER THE REALMS
        </h1>
        <p className="mb-6 mt-3 max-w-[54ch] text-[15.5px] opacity-90">
          Fully onchain strategy. Raise a realm, march your armies, and take the field against ninety-five rivals in
          one-hour Blitz battles — or hold your ground for a whole Eternum season. Every march, every trade, every
          crown: on the chain, forever.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/play"
            className="cut inline-flex items-center border border-[#f7cf7e] bg-gradient-to-b from-amber-hot to-[#b8730a] px-8 py-4 font-heading text-[15px] font-semibold uppercase tracking-[0.1em] text-ink shadow-[0_0_28px_rgba(227,144,1,0.4)] hover:brightness-110"
          >
            See the next game
          </Link>
          <Link
            to="/ranks"
            className="cut inline-flex items-center border border-line bg-inset px-5 py-3.5 font-heading text-[12px] font-semibold uppercase tracking-[0.12em] text-gold hover:border-amber-deep hover:text-amber-hot"
          >
            The ladder
          </Link>
        </div>
      </div>
      <div className="mt-7 grid max-w-[880px] grid-cols-1 gap-3.5 md:grid-cols-2">
        <Link
          to="/play"
          className="group relative flex min-h-[158px] items-end overflow-hidden border border-line p-4 hover:border-amber-deep"
        >
          <img
            src="/art/covers/duel.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
          />
          <span className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0705eb]" />
          <span className="absolute right-3 top-3 z-10 bg-[#0a0705c0]">
            <Pill tone="reg">{next ? `NEXT · ${formatCountdown(next.clock.start_main_at - now)}` : "LOBBY"}</Pill>
          </span>
          <span className="relative z-10">
            <b className="block font-display text-[26px] tracking-[0.05em]">BLITZ</b>
            <small className="text-[12.5px] opacity-85">
              96 lords · one hour · the top of the field takes the pool
            </small>
          </span>
        </Link>
        <Link
          to="/play"
          className="group relative flex min-h-[158px] items-end overflow-hidden border border-line p-4 hover:border-amber-deep"
        >
          <img
            src="/art/covers/realmland.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
          />
          <span className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0705eb]" />
          <span className="absolute right-3 top-3 z-10 bg-[#0a0705c0]">
            <Pill tone="cold">SEASON ONE · SOON</Pill>
          </span>
          <span className="relative z-10">
            <b className="block font-display text-[26px] tracking-[0.05em]">ETERNUM</b>
            <small className="text-[12.5px] opacity-85">
              The long war · pass entry · a living economy · a season to outlast
            </small>
          </span>
        </Link>
      </div>
    </div>
  );
}

function Dashboard({ games, owner, now }: { games: readonly DirectoryGame[]; owner: string; now: number }) {
  const next = nextOpenGame(games);
  const history = useQuery(() => matchHistory(owner, games, 6), [owner, games]);

  return (
    <div className="space-y-4">
      <div className="relative flex min-h-[212px] items-end gap-6 overflow-hidden border border-line p-7">
        <img
          src="/art/covers/duel.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[50%_30%]"
        />
        <span className="absolute inset-0 bg-gradient-to-r from-[#0a0705eb] via-[#0a07058c] to-[#0a070533]" />
        <div className="relative z-10">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.24em] text-amber-hot">
            {next ? `Next game · preset ${next.preset_id}` : "No game open"}
          </div>
          <h2 className="my-1.5 font-display text-[52px] leading-[0.95] tracking-[0.03em]">
            {next ? next.name.toUpperCase() : "THE REALMS REST"}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Link
              to="/play"
              className="cut inline-flex items-center border border-[#f7cf7e] bg-gradient-to-b from-amber-hot to-[#b8730a] px-6 py-3 font-heading text-[13px] font-semibold uppercase tracking-[0.1em] text-ink hover:brightness-110"
            >
              {next ? "View lobby" : "Open the lobby"}
            </Link>
          </div>
        </div>
        {next ? (
          <div className="relative z-10 ml-auto text-right">
            <span className="font-mono text-[32px] font-semibold tabular-nums text-amber-hot">
              {formatCountdown(next.clock.start_main_at - now)}
            </span>
            <small className="block font-mono text-[9.5px] tracking-[0.2em] text-muted">
              UNTIL START · {next.registration?.count ?? next.player_count}/{next.registration?.max ?? "—"} SEATED
            </small>
          </div>
        ) : null}
      </div>

      <Panel>
        <PanelTitle>Recent form</PanelTitle>
        {history.kind === "loading" && <Loading />}
        {history.kind === "error" && <ErrorPanel error={history.error} retry={history.refresh} />}
        {history.kind === "ok" && (
          <MatchList rows={history.value} empty="No finished games yet — your first result lands here." />
        )}
      </Panel>
    </div>
  );
}

export function HomeScreen() {
  const { session } = useSession();
  const now = useNowSeconds();
  const directory = useQuery(() => Effect.flatMap(HeraldClient, (herald) => herald.directory), [], { pollMs: 20_000 });

  if (directory.kind === "error") return <ErrorPanel error={directory.error} retry={directory.refresh} />;
  const games = directory.kind === "ok" ? directory.value.games : [];

  if (session === undefined || directory.kind === "loading") return <Loading />;
  if (!session) return <Landing next={nextOpenGame(games)} now={now} />;
  return <Dashboard games={games} owner={session.address} now={now} />;
}
