import type { GameRef } from "@bibliothecadao/eternum/shard";
import type {
  HeraldFrontierLeaderboard,
  HeraldGameClock,
  HeraldGameDirectoryEntry,
} from "@bibliothecadao/eternum/game-sync";

import { SEASON_WORDS } from "@/ui/design-system/kit/words";

import type { DirectoryGame } from "../../herald";
// The archive lives in packages/core, so the identity side reads the same board (apps/realms/scripts/comeback-email.ts).
import playtest from "../../../../../../packages/core/src/sync/season-archives/playtest.json";
import seasonZero from "../../../../../../packages/core/src/sync/season-archives/season-zero.json";

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
  game: ArchivedGameEntry;
  leaderboard: HeraldFrontierLeaderboard;
}

type ArchivedGameEntry = Omit<HeraldGameDirectoryEntry, "clock_scale" | "clock"> & {
  clock_scale?: number;
  clock: Omit<HeraldGameClock, "scheduled_end_at"> & { scheduled_end_at?: number };
};

const REAL_SPEED = 1;

/**
 * Prod's October season, the Playtest, torn down with release 4's shard on Nov 2. It goes by its name, never a number
 * (owner, 2 November 2026: "its not season 1 its playtest tbh, and devcon season is s0").
 */
const ARCHIVES = [
  { file: playtest as SeasonArchive, name: SEASON_WORDS.playtest },
  { file: seasonZero as SeasonArchive, name: SEASON_WORDS.seasonZero },
];

const sameGame = (archive: SeasonArchive, game: GameRef) =>
  archive.chain_id === game.chainId.toLowerCase() && archive.game.game_id === game.gameId;

/** The archived seasons as the directory would list them. */
export const ARCHIVED_SEASONS: readonly DirectoryGame[] = ARCHIVES.map(({ file }) => ({
  ...file.game,
  clock_scale: file.game.clock_scale ?? REAL_SPEED,
  clock: { ...file.game.clock, scheduled_end_at: file.game.clock.scheduled_end_at ?? file.game.clock.end_at },
  chainId: file.chain_id,
}));

/**
 * An archived season's final board and the name it goes by in place of its number ("Playtest"); undefined for a game on
 * a shard.
 */
export const archivedSeason = (game: GameRef) => {
  const archive = ARCHIVES.find(({ file }) => sameGame(file, game));
  return archive && { board: archive.file.leaderboard, name: archive.name };
};
