import { Link } from "react-router-dom";

import { buildEntryHref } from "@/play/navigation/play-route";

import { type DirectoryGame, isGameOver } from "./herald";
import { formatCountdown, formatLocalTime } from "./format";
import { Pill, type PillTone } from "./kit";

export const statusPill = (game: DirectoryGame): { tone: PillTone; label: string } => {
  switch (game.status) {
    case "Created":
    case "Registration":
      return { tone: "open", label: game.ready ? "OPEN" : "PREPARING" };
    case "Live":
      return { tone: "live", label: "LIVE" };
    default:
      return { tone: "done", label: "FINISHED" };
  }
};

export const modeLabel = (game: DirectoryGame): string => {
  switch (game.mode) {
    case "frontier":
      return "Frontier";
    case "blitz":
      return "Blitz";
    case "eternum":
      return "Eternum";
    case "duel":
      return "Duel";
    default:
      return `Preset ${game.preset_id}`;
  }
};

const entryHref = (game: DirectoryGame, intent: "play" | "spectate"): string =>
  buildEntryHref({ chainId: game.chainId, gameId: game.game_id, intent, autoSettle: false });

const LINK =
  "inline-flex items-center justify-center rounded-lg px-5 py-3 font-cinzel text-[13px] font-semibold uppercase tracking-[0.1em]";

export const EnterLink = ({ game }: { game: DirectoryGame }) => (
  <Link
    to={entryHref(game, "play")}
    className={`${LINK} border border-gold/60 bg-gold text-brown hover:brightness-110`}
  >
    Enter game
  </Link>
);

export const SpectateLink = ({ game }: { game: DirectoryGame }) => (
  <Link to={entryHref(game, "spectate")} className={`${LINK} border border-gold/40 text-gold hover:bg-gold/10`}>
    {isGameOver(game) ? "Review" : "Spectate"}
  </Link>
);

/** One line of when a game starts or ends, relative to now. */
export const GameClock = ({ game, now }: { game: DirectoryGame; now: number }) => {
  if (isGameOver(game)) return <span>Ended {formatLocalTime(game.clock.end_at)}</span>;
  const at = game.status === "Live" ? game.clock.end_at : game.clock.start_main_at;
  return (
    <span>
      {game.status === "Live" ? "Ends" : "Starts"} {formatLocalTime(at)} · {formatCountdown(at - now)}
    </span>
  );
};

export const GameRow = ({
  game,
  selected,
  onSelect,
}: {
  game: DirectoryGame;
  selected: boolean;
  onSelect: () => void;
}) => {
  const pill = statusPill(game);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg border border-gold/20 bg-black/40 p-3 text-left hover:border-gold/50 aria-[current=true]:border-gold"
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold text-gold">{game.name}</span>
        <span className="block text-[11px] text-gold/60">
          {modeLabel(game)} · {game.player_count} players
        </span>
      </span>
      <Pill tone={pill.tone}>{pill.label}</Pill>
    </button>
  );
};
