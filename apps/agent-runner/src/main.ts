// Agent runner CLI, M2 part 1: boot the game client, connect a signer, make sure the player is settled, and print
// the ready line. The decision loop (part 2) starts from the same state.
import { parseArgs, resolveConfig, resolveDataDir, RunnerConfigError, type RunnerConfig } from "./config";
import { defaultUsername, ensureSettled, type SettledEmpire } from "./entry";
import { connectRunnerGame, type RunnerGame } from "./game";
import { resolveRunnerSigner } from "./signer";
import { createRunnerTools } from "./tools";

async function main(): Promise<void> {
  const config = loadConfig();
  const game = await connectRunnerGame(config);
  try {
    const dataDir = resolveDataDir(config, game.client.gameId);
    const signer = await resolveRunnerSigner(config, game.client, dataDir);
    const empire = signer
      ? await ensureSettled(game, signer, config.username ?? defaultUsername(signer.address))
      : { structures: [], explorers: [] };
    const tools = createRunnerTools(game, dataDir);
    printReady(
      game,
      empire,
      tools.map((tool) => tool.name),
    );
  } finally {
    game.client.dispose();
  }
}

function loadConfig(): RunnerConfig {
  try {
    return resolveConfig(parseArgs(process.argv.slice(2)), process.env);
  } catch (error) {
    if (error instanceof RunnerConfigError) fail(error.message);
    throw error;
  }
}

function printReady(game: RunnerGame, empire: SettledEmpire, tools: string[]): void {
  console.log(
    JSON.stringify({
      event: "agent_runner_ready",
      gameId: game.client.gameId,
      gameName: game.listing.name,
      viewer: `0x${game.viewer().toString(16)}`,
      structures: empire.structures,
      explorers: empire.explorers,
      tools,
    }),
  );
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

await main();
process.exit(0);
