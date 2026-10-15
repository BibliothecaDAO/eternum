import { seatFreshGames, seatRoster, type LauncherSeats } from "./seat-pipeline";

/** One game of a closed slot: its durable name, how many players its frozen roster seats, and the account seating it. */
export interface SlotGame {
  name: string;
  players: number;
  seater: string;
}

/** The shard as a slot launch drives it: the scheduler creates the games, and each seater seats its own. */
export interface SlotChain {
  /** The scheduler's pre-confirmed nonce: the first one the chain has not taken. */
  nextNonce(): Promise<bigint>;
  /** The id a game name holds on the shard; 0 until its create has executed. */
  gameId(name: string): Promise<number>;
  /** Sends a game's create at this scheduler nonce without waiting for it; returns its hash. */
  sendCreate(game: SlotGame, nonce: bigint): Promise<string>;
  /** Waits until a sent create is in a closed block, and with it every create before it on the scheduler's nonces. */
  awaitClosed(transactionHash: string): Promise<void>;
  /**
   * Refuses a game whose stored identity, roster or seater is not the one this launch would create, and readies what
   * its seats carry. Every game is verified concurrently before the first seat.
   */
  verify(game: SlotGame, gameId: number): Promise<void>;
  /** Whether the game's whole roster is seated. */
  ready(gameId: number): Promise<boolean>;
  /** The seat stream of one seater: its own nonce sequence. */
  seats(seater: string): LauncherSeats;
}

export interface LaunchedGame extends SlotGame {
  gameId: number;
  /** Seats this launch sent for the game, not counting resends. */
  seats: number;
}

/**
 * Launches a closed slot as one run: the scheduler creates every missing game on consecutive nonces with one wait,
 * then every seater seats its own games side by side, each in its own pipeline, and verifies and tops up each of its
 * games. A run that restarts after a crash finds the games it already created, skips their creates, and settles their
 * seating through the same verification, so the launch is safe to run again from any point.
 */
export async function launchSlot(chain: SlotChain, games: readonly SlotGame[]): Promise<LaunchedGame[]> {
  const created = await createMissingGames(chain, games);
  const ids = await Promise.all(games.map((game) => chain.gameId(game.name)));
  if (ids.some((id) => id === 0)) throw new Error("created_game_not_readable");
  await Promise.all(games.map((game, index) => chain.verify(game, ids[index]!)));
  const placed = games.map((game, index) => ({ ...game, gameId: ids[index]!, fresh: created.has(game.name) }));
  const seats = await seatEverySeater(chain, placed);
  return placed.map(({ name, players, seater, gameId }) => ({
    name,
    players,
    seater,
    gameId,
    seats: seats.get(gameId) ?? 0,
  }));
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

type PlacedGame = SlotGame & { gameId: number; fresh: boolean };

/**
 * Runs every seater's stream side by side. A stream that fails leaves only its own games unready; the others finish,
 * and the run then fails so the registrar retries, which finds the finished games ready. Returns the seats sent per game.
 */
async function seatEverySeater(chain: SlotChain, games: readonly PlacedGame[]) {
  const seaters = [...new Set(games.map((game) => game.seater))];
  const streams = await Promise.allSettled(
    seaters.map((seater) =>
      seatOwnGames(
        chain,
        chain.seats(seater),
        games.filter((game) => game.seater === seater),
      ),
    ),
  );
  const failed = streams.find((stream) => stream.status === "rejected");
  if (failed) throw failed.reason;
  const seats = new Map(streams.flatMap((stream) => (stream.status === "fulfilled" ? [...stream.value] : [])));
  if ((await Promise.all(games.map((game) => chain.ready(game.gameId)))).includes(false))
    throw new Error("slot_roster_not_ready");
  return seats;
}

/**
 * One seater's stream: the games this run created go out in one pipeline, then each of its games that is not ready
 * (one a reverted seat left short, or one an earlier run created) is topped up on the same stream.
 */
async function seatOwnGames(chain: SlotChain, seats: LauncherSeats, games: readonly PlacedGame[]) {
  const fresh = games.filter((game) => game.fresh);
  await seatFreshGames(seats, fresh);
  const sent = new Map(fresh.map(({ gameId, players }) => [gameId, players]));
  for (const { gameId } of games) {
    if (await chain.ready(gameId)) continue;
    sent.set(gameId, (sent.get(gameId) ?? 0) + (await seatRoster(seats, gameId)));
  }
  return sent;
}
