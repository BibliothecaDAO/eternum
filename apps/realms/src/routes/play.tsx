import { useState } from "react";
import { Effect } from "effect";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { env } from "@/env";
import { HeraldClient, type DirectoryGame } from "@/services/herald";
import {
  computePayouts,
  LedgerClient,
  registrationTotal,
  type EconomicPreset,
  type GameEconomy,
  type LedgerRegistration,
} from "@/services/ledger";
import { nextOpenGame } from "@/ui/frame";
import { formatCountdown, formatLocalTime, formatLords, ordinal } from "@/ui/format";
import { useMutation, useQuery } from "@/ui/hooks";
import { ErrorPanel, Flavor, GoldButton, GhostButton, Loading, Panel, Pill, StatBlock, type PillTone } from "@/ui/kit";
import { useNowSeconds, useSession } from "@/ui/session";

const statusPill = (game: DirectoryGame): { tone: PillTone; label: string } => {
  switch (game.status) {
    case "Created":
    case "Registration":
      return { tone: "reg", label: "REGISTERING" };
    case "Live":
      return { tone: "live", label: "LIVE" };
    default:
      return { tone: "done", label: "FINISHED" };
  }
};

const isOpen = (game: DirectoryGame) => game.status === "Created" || game.status === "Registration";

const sortForLobby = (games: readonly DirectoryGame[]): DirectoryGame[] =>
  [...games].sort((a, b) => {
    const phase = (game: DirectoryGame) => (isOpen(game) ? 0 : game.status === "Live" ? 1 : 2);
    if (phase(a) !== phase(b)) return phase(a) - phase(b);
    return phase(a) === 2 ? b.clock.end_at - a.clock.end_at : a.clock.start_main_at - b.clock.start_main_at;
  });

const playUrl = (gameId: number, spectate: boolean) =>
  `${env.VITE_PUBLIC_GAME_ORIGIN}/play?game=${gameId}${spectate ? "&spectate=true" : ""}`;

function GameList({
  games,
  selected,
  onSelect,
}: {
  games: DirectoryGame[];
  selected: number | undefined;
  onSelect: (id: number) => void;
}) {
  return (
    <div>
      {games.map((game) => {
        const pill = statusPill(game);
        return (
          <button
            key={game.game_id}
            type="button"
            onClick={() => onSelect(game.game_id)}
            aria-current={game.game_id === selected}
            className="mb-2 flex w-full items-center gap-3 border border-line-soft border-l-[3px] border-l-transparent bg-panel px-3.5 py-3 text-left hover:border-amber-deep aria-[current=true]:border-l-amber aria-[current=true]:bg-raised"
          >
            <span>
              <b className="block text-[14px] font-semibold leading-tight">{game.name.toUpperCase()}</b>
              <small className="text-[11.5px] text-muted">
                {game.mode ?? "blitz"} · preset {game.preset_id}
              </small>
            </span>
            <span className="ml-auto">
              <Pill tone={pill.tone}>{pill.label}</Pill>
            </span>
          </button>
        );
      })}
      {games.length === 0 && <Loading label="No games in the directory" />}
    </div>
  );
}

function PrizePanel({ economy, preset, seatsMax }: { economy: GameEconomy; preset: EconomicPreset; seatsMax: number }) {
  const fullPool = preset.entryFee * BigInt(seatsMax);
  const projected = computePayouts({
    pool: fullPool,
    protocolCutBps: preset.protocolCutBps,
    paidFractionBps: preset.paidFractionBps,
    decayBps: preset.decayBps,
    seats: seatsMax,
  });
  const first = projected.allocations[0];
  const last = projected.allocations[projected.allocations.length - 1];
  const sampled = [1, 5, 10, 15, projected.winners]
    .filter((position, index, all) => position <= projected.winners && all.indexOf(position) === index)
    .map((position) => ({ position, amount: projected.allocations[position - 1] ?? 0n }));
  const max = first ?? 1n;

  return (
    <div className="border border-line-soft bg-inset px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-muted">
        <span>
          pool now <b className="font-mono text-[15px] font-semibold text-amber-hot">{formatLords(economy.pool)} ◆</b>
        </span>
        <span>
          at full seats <b className="font-mono text-[15px] font-semibold text-amber-hot">{formatLords(fullPool)} ◆</b>
        </span>
        {first !== undefined && (
          <span>
            1st takes <b className="font-mono text-[15px] font-semibold text-amber-hot">{formatLords(first)} ◆</b>
          </span>
        )}
        {last !== undefined && projected.winners > 1 && (
          <span>
            {ordinal(projected.winners)} takes{" "}
            <b className="font-mono text-[15px] font-semibold text-amber-hot">{formatLords(last)} ◆</b>
          </span>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint hover:text-gold">
          Full payout curve · top {projected.winners} paid · {preset.protocolCutBps / 100}% protocol cut
        </summary>
        <div className="mt-2.5 grid gap-1">
          {sampled.map(({ position, amount }) => (
            <div
              key={position}
              className="grid grid-cols-[44px_1fr_84px] items-center gap-2.5 font-mono text-[10.5px] text-muted"
            >
              <span>{ordinal(position).toUpperCase()}</span>
              <span
                className="h-2 bg-gradient-to-r from-amber to-amber-deep"
                style={{ width: `${Number((amount * 100n) / max)}%` }}
              />
              <span className="tabular-nums">{formatLords(amount)} ◆</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function RegisterPanel({
  game,
  economy,
  preset,
  registration,
  onRegistered,
}: {
  game: DirectoryGame;
  economy: GameEconomy;
  preset: EconomicPreset;
  registration: LedgerRegistration | null;
  onRegistered: () => void;
}) {
  const { session } = useSession();
  const [sword, setSword] = useState(false);
  const [shield, setShield] = useState(false);
  const register = useMutation(() =>
    Effect.flatMap(LedgerClient, (ledger) => ledger.register(game.game_id, { sword, shield })),
  );

  if (registration?.registered) {
    return (
      <div className="mt-3.5 flex flex-wrap items-center gap-4 border border-[#4c5433] bg-[#b5bd7510] px-4 py-3">
        <span className="font-heading text-[13px] font-semibold uppercase tracking-[0.08em] text-sage">
          ✓ Seated · {economy.registeredCount} of {game.registration?.max ?? "—"}
        </span>
        {registration.sword && <span className="text-[12.5px] text-muted">Sword equipped</span>}
        {registration.shield && <span className="text-[12.5px] text-muted">Shield equipped</span>}
        <span className="ml-auto">
          <GoldButton onClick={() => window.open(playUrl(game.game_id, false), "_blank")}>
            {game.status === "Live" ? "Launch" : "Launch at start"}
          </GoldButton>
        </span>
      </div>
    );
  }

  const total = registrationTotal(preset, { sword, shield });
  const pending = register.state.kind === "pending";

  return (
    <div className="mt-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-2.5 border border-line bg-inset px-3 py-2.5 hover:border-amber-deep">
          <input
            type="checkbox"
            checked={sword}
            onChange={(event) => setSword(event.target.checked)}
            className="accent-amber"
          />
          <span>
            <b className="block text-[12.5px] font-semibold">Sword</b>
            <small className="text-[11px] text-muted">Doubles a rating gain</small>
          </span>
          <span className="ml-auto font-mono text-[12px] font-semibold text-gold">
            +{formatLords(preset.swordPrice)} ◆
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 border border-line bg-inset px-3 py-2.5 hover:border-amber-deep">
          <input
            type="checkbox"
            checked={shield}
            onChange={(event) => setShield(event.target.checked)}
            className="accent-amber"
          />
          <span>
            <b className="block text-[12.5px] font-semibold">Shield</b>
            <small className="text-[11px] text-muted">Halves a rating loss</small>
          </span>
          <span className="ml-auto font-mono text-[12px] font-semibold text-gold">
            +{formatLords(preset.shieldPrice)} ◆
          </span>
        </label>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-3.5">
        <GoldButton
          big
          disabled={!session || pending}
          onClick={() => void register.run().then((hash) => hash !== undefined && onRegistered())}
        >
          {pending ? "Confirming on chain…" : `Register · ${formatLords(total)} ◆`}
        </GoldButton>
        {session ? <Flavor>One signature seals it.</Flavor> : <Flavor>Sign in to take a seat.</Flavor>}
      </div>
      {register.state.kind === "error" && (
        <div className="mt-2.5">
          <ErrorPanel error={register.state.error} />
        </div>
      )}
    </div>
  );
}

function GameDetail({ game, now }: { game: DirectoryGame; now: number }) {
  const { session } = useSession();
  const pill = statusPill(game);

  const economy = useQuery(() => Effect.flatMap(LedgerClient, (ledger) => ledger.game(game.game_id)), [game.game_id], {
    pollMs: 15_000,
  });
  const preset = useQuery(
    () =>
      Effect.gen(function* () {
        const ledger = yield* LedgerClient;
        const row = yield* ledger.game(game.game_id);
        return row.exists ? yield* ledger.preset(row.presetId) : null;
      }),
    [game.game_id],
  );
  const registration = useQuery(
    () =>
      session
        ? Effect.flatMap(LedgerClient, (ledger) =>
            ledger
              .registration(game.game_id, session.address)
              .pipe(Effect.map((row) => row as LedgerRegistration | null)),
          )
        : Effect.succeed(null),
    [game.game_id, session?.address],
    { pollMs: 12_000 },
  );

  const secondsToStart = game.clock.start_main_at - now;
  const seatsMax = game.registration?.max ?? 0;

  return (
    <Panel>
      <div className="mb-3.5 flex flex-wrap items-center gap-3.5">
        <h2 className="font-display text-[38px] leading-none tracking-[0.04em]">{game.name.toUpperCase()}</h2>
        <Pill tone={pill.tone}>{pill.label}</Pill>
        {game.status === "Live" && (
          <span className="ml-auto">
            <GhostButton onClick={() => window.open(playUrl(game.game_id, true), "_blank")}>Spectate</GhostButton>
          </span>
        )}
      </div>

      {isOpen(game) && (
        <div className="grid gap-2.5 md:grid-cols-3">
          <StatBlock
            label="Starts in"
            value={formatCountdown(secondsToStart)}
            sub={`${formatLocalTime(game.clock.start_main_at)} local`}
          />
          <StatBlock
            label="Your entry"
            value={preset.kind === "ok" && preset.value ? `${formatLords(preset.value.entryFee)} ◆` : "—"}
            sub="refunded in full if the game is cancelled"
          />
          <StatBlock
            label="Seats"
            value={
              economy.kind === "ok" && economy.value.exists
                ? `${economy.value.registeredCount} / ${seatsMax || "—"}`
                : `${game.registration?.count ?? 0} / ${seatsMax || "—"}`
            }
            sub={economy.kind === "ok" && !economy.value.exists ? "not opened on the ledger yet" : undefined}
          />
        </div>
      )}

      <div className="mt-2.5 space-y-2.5">
        {(economy.kind === "error" || preset.kind === "error") && (
          <ErrorPanel
            error={economy.kind === "error" ? economy.error : preset.kind === "error" ? preset.error : null}
          />
        )}
        {economy.kind === "ok" && economy.value.exists && preset.kind === "ok" && preset.value && seatsMax > 0 && (
          <PrizePanel economy={economy.value} preset={preset.value} seatsMax={seatsMax} />
        )}
        {isOpen(game) && economy.kind === "ok" && economy.value.exists && preset.kind === "ok" && preset.value && (
          <RegisterPanel
            game={game}
            economy={economy.value}
            preset={preset.value}
            registration={registration.kind === "ok" ? registration.value : null}
            onRegistered={registration.refresh}
          />
        )}
        {!isOpen(game) &&
          game.status !== "Live" &&
          session &&
          registration.kind === "ok" &&
          registration.value?.registered && (
            <FinishedResult gameId={game.game_id} owner={session.address} paid={registration.value.paid} />
          )}
      </div>
    </Panel>
  );
}

function FinishedResult({ gameId, owner, paid }: { gameId: number; owner: string; paid: bigint }) {
  const result = useQuery(
    () => Effect.flatMap(LedgerClient, (ledger) => ledger.playerResult(gameId, owner)),
    [gameId, owner],
  );
  if (result.kind === "loading") return <Loading />;
  if (result.kind === "error") return <ErrorPanel error={result.error} retry={result.refresh} />;
  if (result.value.rank === 0)
    return <div className="text-[13px] text-muted">Results are not posted to the ledger yet.</div>;
  const delta = result.value.payout - paid;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border border-line-soft bg-inset px-4 py-3 text-[13px] text-muted">
      <span>
        placed <b className="font-mono text-[15px] text-parchment">{ordinal(result.value.rank)}</b>
      </span>
      <span className={delta >= 0n ? "text-sage" : "text-coral"}>
        {delta >= 0n ? "+" : "−"}
        <span className="font-mono text-[15px] tabular-nums">{formatLords(delta >= 0n ? delta : -delta)}</span> ◆
      </span>
      {result.value.chests > 0 && <span>🎁 {result.value.chests} chest(s) minted</span>}
    </div>
  );
}

export function PlayScreen() {
  const search = useSearch({ from: "/play" });
  const navigate = useNavigate({ from: "/play" });
  const now = useNowSeconds();
  const directory = useQuery(() => Effect.flatMap(HeraldClient, (herald) => herald.directory), [], { pollMs: 10_000 });

  if (directory.kind === "loading") return <Loading />;
  if (directory.kind === "error") return <ErrorPanel error={directory.error} retry={directory.refresh} />;

  const games = sortForLobby(directory.value.games);
  const selectedId = search.game ?? nextOpenGame(games)?.game_id ?? games[0]?.game_id;
  const selected = games.find((game) => game.game_id === selectedId);

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[320px_1fr]">
      <GameList games={games} selected={selectedId} onSelect={(game) => void navigate({ search: { game } })} />
      {selected ? <GameDetail game={selected} now={now} /> : <Panel>No game selected.</Panel>}
    </div>
  );
}
