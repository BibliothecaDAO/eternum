// Agent runner CLI: boot the game client, connect a signer, make sure the player is settled, build the agent, and
// run the decision loop until the game ends or a stop condition fires.
import path from "node:path";
import { Agent, type AgentTool, type StreamFn } from "@mariozechner/pi-agent-core";

import { parseArgs, resolveConfig, resolveDataDir, RunnerConfigError, type RunnerConfig } from "./config";
import { createFileDirectionSource, createScriptedDirectionSource, type DirectionSource } from "./directions";
import { defaultUsername, ensureSettled, type SettledEmpire } from "./entry";
import { createOfflineStreamFn, resolveOfflineScout } from "./fake-stream";
import { connectRunnerGame, type RunnerGame } from "./game";
import { logEvent } from "./log";
import { resolveLoopSettings, runAgentLoop } from "./loop";
import { createRunManifest, type RunManifestRecorder } from "./manifest";
import { resolveModel } from "./model";
import { renderGameSummary } from "./prompt";
import { resolveRunnerSigner } from "./signer";
import { createSystemPromptSource, type SystemPromptSource } from "./soul";
import { createRunnerTools } from "./tools";
import type { StopReason } from "./wake";

const DIRECTIONS_DIR = "directions";
const OFFLINE_DIRECTION = "Scout outward with every explorer and report what you find.";

async function main(): Promise<number> {
  const config = loadConfig();
  const game = await connectRunnerGame(config);
  try {
    const dataDir = resolveDataDir(config, game.client.gameId);
    const signer = await resolveRunnerSigner(config, game.client, dataDir);
    const empire = signer
      ? await ensureSettled(game, signer, config.username ?? defaultUsername(signer.address))
      : { structures: [], explorers: [] };
    const tools = createRunnerTools(game, dataDir);
    const model = resolveModel(config.modelProfile);
    const systemPrompt = createSystemPromptSource({
      dataDir,
      gameSummary: describeGame(game, config, empire),
      toolGuide: tools,
    });
    const agent = await buildAgent(model, tools, systemPrompt, resolveStreamFn(config, game, empire));
    const manifest = createRunManifest({
      dataDir,
      chain: { chain: config.chain, rpcUrl: config.rpcUrl, heraldUrl: config.heraldUrl },
      game: {
        gameId: game.client.gameId,
        gameName: game.listing.name,
        mode: game.listing.mode,
        viewer: viewerAddress(game),
      },
      model: { profile: config.modelProfile, id: model.id },
    });
    printReady(game, empire, tools);
    const stopReason = await runAgentLoop({
      game,
      agent,
      manifest,
      systemPrompt,
      directions: resolveDirectionSource(config, dataDir),
      settings: resolveLoopSettings(config, game.listing),
      dataDir,
      signal: interruptSignal(),
    });
    printManifest(manifest);
    return exitCodeFor(stopReason);
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

async function buildAgent(
  model: ReturnType<typeof resolveModel>,
  tools: AgentTool[],
  systemPrompt: SystemPromptSource,
  streamFn: StreamFn | undefined,
): Promise<Agent> {
  return new Agent({ initialState: { systemPrompt: await systemPrompt.current(), model, tools }, streamFn });
}

/** Offline runs play against the scripted model, scouting with one explorer; live runs stream from OpenRouter. */
function resolveStreamFn(config: RunnerConfig, game: RunnerGame, empire: SettledEmpire): StreamFn | undefined {
  return config.offline ? createOfflineStreamFn(resolveOfflineScout(game, empire)) : undefined;
}

function describeGame(game: RunnerGame, config: RunnerConfig, empire: SettledEmpire): string {
  return renderGameSummary({
    gameId: game.client.gameId,
    gameName: game.listing.name,
    mode: game.listing.mode,
    chain: config.chain,
    viewer: game.client.signer ? viewerAddress(game) : null,
    structures: empire.structures,
    explorers: empire.explorers,
  });
}

/** Offline runs get one scripted direction so the direction path is exercised without a gateway or a file drop. */
function resolveDirectionSource(config: RunnerConfig, dataDir: string): DirectionSource {
  return config.offline
    ? createScriptedDirectionSource([OFFLINE_DIRECTION])
    : createFileDirectionSource(path.join(dataDir, DIRECTIONS_DIR));
}

function interruptSignal(): AbortSignal {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  return controller.signal;
}

function printReady(game: RunnerGame, empire: SettledEmpire, tools: AgentTool[]): void {
  logEvent("agent_runner_ready", {
    gameId: game.client.gameId,
    gameName: game.listing.name,
    viewer: viewerAddress(game),
    structures: empire.structures,
    explorers: empire.explorers,
    tools: tools.map((tool) => tool.name),
  });
}

function printManifest(manifest: RunManifestRecorder): void {
  logEvent("agent_runner_manifest", { ...manifest.snapshot() });
}

const viewerAddress = (game: RunnerGame): string => `0x${game.viewer().toString(16)}`;

const exitCodeFor = (stopReason: StopReason): number => (stopReason === "sync-failed" ? 1 : 0);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

process.exit(await main());
