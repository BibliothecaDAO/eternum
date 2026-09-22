import { Effect } from "effect";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { env } from "@/env";
import { HeraldClient, type DirectoryGame } from "@/services/herald";
import { IdentityApi } from "@/services/identity";
import { PlaytestClient, type PlaytestSlot } from "@/services/playtest";
import { nextOpenGame } from "@/ui/next-game";
import { formatCountdown, formatLocalTime, ordinal } from "@/ui/format";
import { useMutation, useQuery } from "@/ui/hooks";
import { ErrorPanel, GoldButton, GhostButton, Loading, Panel, Pill, StatBlock, type PillTone } from "@/ui/kit";
import { useNowSeconds, useSession } from "@/ui/session";

const statusPill = (game: DirectoryGame): { tone: PillTone; label: string } => {
  switch (game.status) {
    case "Created":
    case "Registration":
      return { tone: "reg", label: "PREPARING" };
    case "Live":
      return { tone: "live", label: "LIVE" };
    default:
      return { tone: "done", label: "FINISHED" };
  }
};

/** The game client addresses a game by its shard's chain id and its id there. */
const enterUrl = (chainId: string, game: DirectoryGame, spectate: boolean) =>
  `${env.VITE_PUBLIC_GAME_ORIGIN}/enter/${chainId}/${game.game_id}${spectate ? "?intent=spectate" : ""}`;

function Slot({
  slot,
  registered,
  assignment,
  canRegister,
  onRegister,
  pending,
}: {
  slot: PlaytestSlot;
  registered: boolean;
  assignment: number | null;
  canRegister: boolean;
  onRegister: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft py-3">
      <div>
        <b>{slot.name}</b>
        <p className="text-sm text-muted">
          {slot.registrations.length} registered · closes {new Date(slot.closesAt).toLocaleString()}
        </p>
        {registered && (
          <p role="status" className="text-sage">
            {assignment !== null
              ? `Assigned to ${slot.name}-${assignment}. Your realms are prepared automatically.`
              : slot.closed
                ? "Registered. Your game is being assigned."
                : "Registered. Waiting for the slot to close."}
          </p>
        )}
      </div>
      {!registered && !slot.closed && (
        <GoldButton disabled={!canRegister || pending} onClick={onRegister}>
          {pending ? "Registering…" : "Register free"}
        </GoldButton>
      )}
      {!registered && slot.closed && <span className="text-muted">Registration closed</span>}
    </div>
  );
}

function FreeSlots() {
  const { session } = useSession();
  const slots = useQuery(() => Effect.flatMap(PlaytestClient, (client) => client.slots), [], { pollMs: 3_000 });
  const binding = useQuery(
    () => (session ? Effect.flatMap(IdentityApi, (identity) => identity.gameplayBinding) : Effect.succeed(null)),
    [session?.address],
    { pollMs: 5_000 },
  );
  const register = useMutation((name: string) => Effect.flatMap(PlaytestClient, (client) => client.register(name)));
  return (
    <Panel>
      <h2 className="mb-3 font-display text-3xl">Free Blitz slots</h2>
      <p className="mb-3 text-sm text-muted">Regular Blitz · up to 24 players per game · automatic realm settlement</p>
      {!session && <p>Sign in above to register.</p>}
      {session && binding.kind === "ok" && !binding.value && (
        <p>
          <a className="text-gold underline" href={env.VITE_PUBLIC_GAME_ORIGIN} target="_blank" rel="noreferrer">
            Open the game client to prepare your gameplay account.
          </a>
        </p>
      )}
      {binding.kind === "error" && <ErrorPanel error={binding.error} retry={binding.refresh} />}
      {register.state.kind === "error" && <ErrorPanel error={register.state.error} />}
      {slots.kind === "loading" && <Loading />}
      {slots.kind === "error" && <ErrorPanel error={slots.error} retry={slots.refresh} />}
      {slots.kind === "ok" && slots.value.length === 0 && <p>No slots are scheduled yet.</p>}
      {slots.kind === "ok" &&
        slots.value.map((slot) => {
          const registration = session
            ? slot.registrations.find((entry) => BigInt(entry.owner) === BigInt(session.address))
            : undefined;
          if (slot.frozenAt && !registration) return null;
          return (
            <Slot
              key={slot.name}
              slot={slot}
              registered={Boolean(registration)}
              assignment={registration?.gameNumber ?? null}
              canRegister={Boolean(session && binding.kind === "ok" && binding.value)}
              pending={register.state.kind === "pending"}
              onRegister={() => void register.run(slot.name).then((result) => result && slots.refresh())}
            />
          );
        })}
    </Panel>
  );
}

function GameDetail({ chainId, game, now }: { chainId: string; game: DirectoryGame; now: number }) {
  const { session } = useSession();
  const pill = statusPill(game);
  const facts = useQuery(
    () => Effect.flatMap(HeraldClient, (herald) => herald.gameFacts(game.game_id)),
    [game.game_id],
    { pollMs: 3_000 },
  );
  const registry = facts.kind === "ok" ? facts.value.require("GameRegistry", { game_id: game.game_id }) : undefined;
  const roster = facts.kind === "ok" ? facts.value.get("BlitzRoster", { game_id: game.game_id }) : undefined;
  const result = facts.kind === "ok" ? facts.value.get("BlitzResult", { game_id: game.game_id }) : undefined;
  const member = session && roster?.players.some((entry) => entry.owner === BigInt(session.address));
  const ended = game.clock.end_at > 0 && now >= game.clock.end_at;
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-3xl">{game.name.toUpperCase()}</h2>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <StatBlock label="Players" value={String(roster?.players.length ?? game.player_count)} />
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
      {facts.kind === "error" && <ErrorPanel error={facts.error} retry={facts.refresh} />}
      {facts.kind === "loading" && <Loading />}
      {registry && !registry.ready && (
        <p role="status">Preparing the roster's realms and starting guards. Play opens when everyone is ready.</p>
      )}
      <div className="my-4 flex gap-3">
        {!ended && registry?.ready && (member || game.mode === "eternum") && (
          <GoldButton onClick={() => window.open(enterUrl(chainId, game, false), "_blank")}>Enter game</GoldButton>
        )}
        <GhostButton onClick={() => window.open(enterUrl(chainId, game, true), "_blank")}>
          {ended ? "Review" : "Spectate"}
        </GhostButton>
      </div>
      {game.mode === "blitz" && ended && !result?.complete && <p role="status">Final points are being settled.</p>}
      {result?.complete && (
        <div>
          <h3 className="mb-2 font-heading">Final results</h3>
          {result.players.map((player) => (
            <div
              key={player.player.toString()}
              className="flex justify-between border-t border-line-soft py-2 font-mono text-sm"
            >
              <span>
                {ordinal(player.rank)} · 0x{player.player.toString(16).slice(0, 8)}…
              </span>
              <span>{(Number(player.points) / 1_000_000).toLocaleString()} VP</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function PlayScreen() {
  const search = useSearch({ from: "/play" });
  const navigate = useNavigate({ from: "/play" });
  const now = useNowSeconds();
  const directory = useQuery(() => Effect.flatMap(HeraldClient, (herald) => herald.directory), [], { pollMs: 3_000 });
  const games = directory.kind === "ok" ? directory.value.games : [];
  const selectedId = search.game ?? nextOpenGame(games)?.game_id ?? games[0]?.game_id;
  const selected = games.find((game) => game.game_id === selectedId);
  return (
    <div className="space-y-4">
      <FreeSlots />
      {directory.kind === "loading" && <Loading />}
      {directory.kind === "error" && <ErrorPanel error={directory.error} retry={directory.refresh} />}
      <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
        <div>
          {games.map((game) => {
            const pill = statusPill(game);
            return (
              <button
                key={game.game_id}
                type="button"
                onClick={() => void navigate({ search: { game: game.game_id } })}
                aria-current={game.game_id === selectedId}
                className="mb-2 flex w-full items-center justify-between gap-3 border border-line-soft bg-panel p-3 text-left aria-[current=true]:border-amber"
              >
                <span>{game.name}</span>
                <Pill tone={pill.tone}>{pill.label}</Pill>
              </button>
            );
          })}
        </div>
        {selected && directory.kind === "ok" && (
          <GameDetail key={selected.game_id} chainId={directory.value.chain} game={selected} now={now} />
        )}
      </div>
    </div>
  );
}
