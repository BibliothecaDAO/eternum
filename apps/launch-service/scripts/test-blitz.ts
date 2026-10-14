/**
 * Starts a test Blitz on the dev shard for the named player accounts and waits until they can enter it:
 *
 *   OPERATOR_TOKEN=<dev operator token> pnpm test-blitz test-<label> 0x<account> [0x<account>…]
 *
 * `test-<label>` is the request's identity. Running the same command again, after a lost response or an interrupted
 * wait, returns that same game; the same name with another roster is refused. A player's account is the gameplay
 * account a signed-in dev client sends as `?player=0x…` on its `/api/directory` request.
 *
 * The launch Worker creates the game with that roster and seats it; the game appears in the dev directory, enterable at
 * once, and goes live one preparation window (5 minutes) after the first request. It takes no entry, posts no result
 * and moves no rating. Prints the game's id and address, or the run's error and exits non-zero.
 */
import environments from "../../../deploy/first/environments.json";
import { gamePath } from "../../../packages/notifications/src/delivery";

const ORIGIN = environments.dev.origin;
const POLL_MS = 5_000;
const DEADLINE_MS = 10 * 60_000;
const DIRECTORY_DEADLINE_MS = 60_000;

interface RunRecord {
  gameName: string;
  status: "queued" | "running" | "complete" | "attention";
  steps: { errorMessage?: string }[];
  artifacts: { gameId?: number };
}

const main = async () => {
  const [name, ...players] = process.argv.slice(2);
  const token = process.env.OPERATOR_TOKEN;
  if (!token || !name || !players.length)
    throw new Error("Usage: OPERATOR_TOKEN=<token> pnpm test-blitz test-<label> 0x<account> [...]");
  const queued = await requestTestBlitz(name, players, token);
  console.log(`${queued.gameName} is ${queued.status} for ${players.length} player(s); waiting until it is seated`);
  const gameId = await waitForSeatedGame(queued.gameName);
  const chainId = await directoryChainOf(gameId);
  console.log(
    JSON.stringify({ gameName: queued.gameName, gameId, chainId, url: `${ORIGIN}${gamePath({ chainId, gameId })}` }),
  );
};

const requestTestBlitz = async (name: string, players: string[], token: string): Promise<RunRecord> => {
  const response = await fetch(`${ORIGIN}/api/factory/test-blitz`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name, players }),
  });
  if (response.status !== 202) throw new Error(`Test Blitz refused: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as RunRecord;
};

/** The run completes once the game exists with its roster seated; a failed run names its error. */
const waitForSeatedGame = async (gameName: string): Promise<number> => {
  const deadline = Date.now() + DEADLINE_MS;
  while (Date.now() < deadline) {
    const response = await fetch(`${ORIGIN}/api/factory/runs/madara.blitz/${gameName}`);
    if (!response.ok) throw new Error(`Run ${gameName} unreadable: HTTP ${response.status}`);
    const run = (await response.json()) as RunRecord;
    if (run.status === "complete" && run.artifacts.gameId) return run.artifacts.gameId;
    if (run.status === "attention")
      throw new Error(`Run ${gameName} failed: ${run.steps[0]?.errorMessage ?? "unknown"}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Run ${gameName} did not complete within ${DEADLINE_MS / 60_000} minutes`);
};

/** The shard that lists the game, read until the directory's short cache shows it: proof players can see it. */
const directoryChainOf = async (gameId: number): Promise<string> => {
  const deadline = Date.now() + DIRECTORY_DEADLINE_MS;
  while (Date.now() < deadline) {
    const response = await fetch(`${ORIGIN}/api/directory`);
    if (!response.ok) throw new Error(`Directory unreadable: HTTP ${response.status}`);
    const { shards } = (await response.json()) as {
      shards: { chainId: string; games: { game_id: number; mode: string; slotId: number | null }[] | null }[];
    };
    const shard = shards.find(({ games }) =>
      games?.some((game) => game.game_id === gameId && game.mode === "blitz" && game.slotId === null),
    );
    if (shard) return shard.chainId;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Game ${gameId} was created but the directory does not list it`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
