import { formatAmount, formatClockTime, formatOrdinal } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useLocation } from "react-router-dom";

import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { clockLine } from "@/ui/design-system/kit/clock-chip";
import { ListRow, RowThumb } from "@/ui/design-system/kit/list-row";
import { openedFrom } from "../frame/opened-from";
import { isSameStarknetAddress } from "@realms-world/identity";
import { type DirectoryGame, useLeaderboard } from "../herald";
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
  const entry = board.data?.entries.find((candidate) => isSameStarknetAddress(candidate.address, player));
  return { rank: entry?.rank, lords: undefined };
};

/**
 * A finished game on a player's list (spec 10): its age's painting, its title and date, the player's place, and LORDS
 * for a Frontier season. The row opens the game's Results, whose Back leads back to the list.
 */
export const HistoryRow = ({ game, player, now }: { game: DirectoryGame; player: string; now: number }) => {
  const { rank, lords } = usePlace(game, player);
  const here = useLocation();
  return (
    <ListRow
      as="li"
      to={resultsHref(game)}
      state={openedFrom(here)}
      height={14}
      gap={3}
      lead={<RowThumb painting={ageOf(ageOfGame(game)).painting} size={10} />}
      title={gameTitle(game)}
      line={<span className="text-sm text-kit-muted">{clockLine(null, game.clock.end_at, now)}</span>}
      className="px-1 py-2"
    >
      {lords !== undefined && (
        <span className="flex items-center gap-1 font-body text-base font-bold tabular-nums text-kit-gold">
          <SemanticIcon name="lords" size={18} />
          {formatAmount(lords)}
        </span>
      )}
      <span className="w-12 text-right font-body text-base font-extrabold tabular-nums text-kit-cream">
        {rank === undefined ? "—" : formatOrdinal(rank)}
      </span>
    </ListRow>
  );
};
