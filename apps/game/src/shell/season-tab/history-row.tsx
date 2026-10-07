import { Link } from "react-router-dom";

import { formatAmount } from "@/ui/design-system/kit/amount";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { formatClockTime } from "@/ui/design-system/kit/time";
import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { clockLine } from "../clock-chip";
import { ordinal, sameAddress } from "../format";
import { type DirectoryGame, useLeaderboard } from "../herald";
import { paintingSources } from "../paintings";
import { ageOf, type AgeMode } from "../play/ages";
import { resultsHref } from "./results-link";

const ageOfGame = (game: DirectoryGame): AgeMode => (game.mode === "frontier" ? "frontier" : "blitz");

/** A finished game's title, like its lobby's: its mode and its start time ("Blitz 15:00"). */
export const gameTitle = (game: DirectoryGame) =>
  `${ageOf(ageOfGame(game)).name} ${formatClockTime(game.clock.start_main_at)}`;

/** The player's place in a finished game ("3rd"), and for a Frontier season the LORDS its Ruin chests paid. */
const usePlace = (game: DirectoryGame, player: string) => {
  const board = useLeaderboard({ chainId: game.chainId, gameId: game.game_id });
  if (board.data?.mode === "frontier") {
    const own = findOwnEntry(board.data.entries, player);
    return { rank: own?.rank, lords: own && wholeLords(own.rewards.lords) };
  }
  const entry = board.data?.entries.find((candidate) => sameAddress(candidate.address, player));
  return { rank: entry?.rank, lords: undefined };
};

/**
 * A finished game on a list (spec 09, 10): its age's painting, its title and date, the player's place, and LORDS for a
 * Frontier season. The row opens the game's Results.
 */
export const HistoryRow = ({ game, player, now }: { game: DirectoryGame; player: string; now: number }) => {
  const { rank, lords } = usePlace(game, player);
  return (
    <li className="border-b border-kit-line last:border-b-0">
      <Link to={resultsHref(game, true)} className="flex min-h-14 items-center gap-3 px-1 py-2">
        <img
          {...paintingSources(ageOf(ageOfGame(game)).painting)}
          sizes="48px"
          alt=""
          className="size-10 shrink-0 rounded-lg object-cover"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-ui text-[15px] font-bold text-kit-cream">{gameTitle(game)}</span>
          <span className="text-[13px] text-kit-muted">{clockLine(null, game.clock.end_at, now)}</span>
        </span>
        {lords !== undefined && (
          <span className="flex items-center gap-1 font-ui text-[15px] font-bold tabular-nums text-kit-gold">
            <KitIcon code="Lo" size={18} />
            {formatAmount(lords)}
          </span>
        )}
        <span className="w-12 text-right font-ui text-[15px] font-extrabold tabular-nums text-kit-cream">
          {rank === undefined ? "—" : ordinal(rank)}
        </span>
      </Link>
    </li>
  );
};
