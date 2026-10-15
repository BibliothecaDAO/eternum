import { seatFreshGames, seatRoster, type LauncherSeats } from "./seat-pipeline";

/** One game of a closed slot: its durable name and how many players its frozen roster seats. */
export interface SlotGame {
  name: string;
  players: number;
}

/** The shard as a slot launch drives it, on the launcher's one nonce sequence. */
export interface SlotChain extends LauncherSeats {
  /** The id a game name holds on the shard; 0 until its create has executed. */
  gameId(name: string): Promise<number>;
  /** Sends a game's create at this nonce without waiting for it; returns its hash. */
  sendCreate(game: SlotGame, nonce: bigint): Promise<string>;
  /** Waits until a sent create is in a closed block, and with it every create before it on the nonce sequence. */
  awaitClosed(transactionHash: string): Promise<void>;
  /**
   * Refuses a game whose stored identity or roster is not the one this launch would create, and readies what its seats
   * carry. Every game is verified concurrently before the first seat.
   */
  verify(game: SlotGame, gameId: number): Promise<void>;
  /** Whether the game's whole roster is seated. */
  ready(gameId: number): Promise<boolean>;
}

export interface LaunchedGame extends SlotGame {
  gameId: number;
  /** Seats this launch sent for the game, not counting resends. */
  seats: number;
}

/**
 * Launches a closed slot as one run: every missing game is created on consecutive nonces with one wait, every freshly
 * created game is seated in one pipeline, then every game is verified and any that is not ready is topped up. A run
 * that restarts after a crash finds the games it already created, skips their creates, and settles their seating
 * through the same verification, so the launch is safe to run again from any point.
 */
export async function launchSlot(chain: SlotChain, games: readonly SlotGame[]): Promise<LaunchedGame[]> {
  const created = await createMissingGames(chain, games);
  const ids = await Promise.all(games.map((game) => chain.gameId(game.name)));
  if (ids.some((id) => id === 0)) throw new Error("created_game_not_readable");
  await Promise.all(games.map((game, index) => chain.verify(game, ids[index]!)));
  const seats = await seatEveryGame(chain, games, ids, created);
  return games.map((game, index) => ({ ...game, gameId: ids[index]!, seats: seats.get(ids[index]!) ?? 0 }));
}

/**
 * Seats the games this run created in one pipeline, then verifies every game once and tops up any that is not ready:
 * one a reverted seat left short, or one an earlier run created. Returns the seats sent per game.
 */
async function seatEveryGame(
  chain: SlotChain,
  games: readonly SlotGame[],
  ids: readonly number[],
  created: ReadonlySet<string>,
) {
  const fresh = games.flatMap((game, index) => (created.has(game.name) ? [{ ...game, gameId: ids[index]! }] : []));
  await seatFreshGames(chain, fresh);
  const seats = new Map(fresh.map(({ gameId, players }) => [gameId, players]));
  for (const gameId of await unreadyGames(chain, ids)) {
    seats.set(gameId, (seats.get(gameId) ?? 0) + (await seatRoster(chain, gameId)));
  }
  if ((await unreadyGames(chain, ids)).length) throw new Error("slot_roster_not_ready");
  return seats;
}

/** Sends every missing game's create back to back and waits once, for the last; returns the names it created. */
async function createMissingGames(chain: SlotChain, games: readonly SlotGame[]) {
  const existing = await Promise.all(games.map((game) => chain.gameId(game.name)));
  const missing = games.filter((_, index) => existing[index] === 0);
  if (!missing.length) return new Set<string>();
  const first = await chain.nextNonce();
  let last = "";
  for (const [index, game] of missing.entries()) last = await chain.sendCreate(game, first + BigInt(index));
  await chain.awaitClosed(last);
  return new Set(missing.map((game) => game.name));
}

async function unreadyGames(chain: SlotChain, ids: readonly number[]) {
  const ready = await Promise.all(ids.map((id) => chain.ready(id)));
  return ids.filter((_, index) => !ready[index]);
}
