import type { GameRef } from "@bibliothecadao/eternum/shard";
import type { HeraldFrontierLeaderboard, HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";

import { SEASON_WORDS } from "@/ui/design-system/kit/words";

import type { DirectoryGame } from "../../herald";
import seasonOne from "./season-1.json";

/**
 * A season whose shard is gone, kept as its Herald served it after the end: the game's directory entry and its final
 * board, read once at a confirmed block. Its season reads like any ended one; only the shard behind it is missing.
 */
interface SeasonArchive {
  version: 1;
  herald: string;
  chain_id: string;
  confirmed_block: number;
  read_at: string;
  game: HeraldGameDirectoryEntry;
  leaderboard: HeraldFrontierLeaderboard;
}

/** Prod's playtest season, torn down with release 4's shard on Nov 2. */
const ARCHIVES = [{ file: seasonOne as SeasonArchive, label: SEASON_WORDS.playtest }];

const sameGame = (archive: SeasonArchive, game: GameRef) =>
  archive.chain_id === game.chainId.toLowerCase() && archive.game.game_id === game.gameId;

/** The archived seasons as the directory would list them. */
export const ARCHIVED_SEASONS: readonly DirectoryGame[] = ARCHIVES.map(({ file }) => ({
  ...file.game,
  chainId: file.chain_id,
}));

/** An archived season's final board and its name beside its number ("Playtest"); undefined for a game on a shard. */
export const archivedSeason = (game: GameRef) => {
  const archive = ARCHIVES.find(({ file }) => sameGame(file, game));
  return archive && { board: archive.file.leaderboard, label: archive.label };
};
