import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import type { Agent, AgentMessage } from "@mariozechner/pi-agent-core";

import { DEFAULT_COMPACTION, installCompaction, type CompactionSettings } from "./compaction";
import type { RunnerConfig } from "./config";
import { isActionable, observeWorld, summariseDelta, type WorldDelta } from "./delta";
import type { DirectionSource } from "./directions";
import type { RunnerGame } from "./game";
import { logEvent } from "./log";
import type { RunManifestRecorder } from "./manifest";
import { renderGameEndedMessage, renderWakeMessage, renderWorldStateUpdate, WORLD_STATE_UPDATE_PREFIX } from "./prompt";
import type { SystemPromptSource } from "./soul";
import { installToolTape } from "./tool-tape";
import {
  createWakeSources,
  systemClock,
  type Clock,
  type Delivery,
  type LoopSignal,
  type StopReason,
  type Wake,
  type WakeSources,
} from "./wake";

interface LoopSettings {
  quietWindowMs: number;
  heartbeatMs: number;
  maxTicks: number | null;
  compaction: CompactionSettings;
}

export interface AgentLoopInput {
  game: RunnerGame;
  agent: Agent;
  manifest: RunManifestRecorder;
  systemPrompt: SystemPromptSource;
  directions: DirectionSource;
  settings: LoopSettings;
  dataDir: string;
  clock?: Clock;
  /** Aborting stops the loop after the current run: the SIGINT path. */
  signal?: AbortSignal;
}

const BLITZ_HEARTBEAT_MS = 5 * 60_000;
const ETERNUM_HEARTBEAT_MS = 30 * 60_000;

export const resolveLoopSettings = (config: RunnerConfig, listing: HeraldGameDirectoryEntry): LoopSettings => ({
  quietWindowMs: config.quietWindowMs,
  heartbeatMs: config.heartbeatMs ?? (listing.mode === "blitz" ? BLITZ_HEARTBEAT_MS : ETERNUM_HEARTBEAT_MS),
  maxTicks: config.maxTicks,
  compaction: DEFAULT_COMPACTION,
});

/**
 * Wake, look at what changed since the model last saw the world, decide whether that is worth a model call, deliver
 * it in the way the agent's state allows, record the tick, and wait for the next wake.
 */
export async function runAgentLoop(input: AgentLoopInput): Promise<StopReason> {
  const { game, agent, manifest, settings } = input;
  installCompaction(agent, settings.compaction, () => input.systemPrompt.current());
  installToolTape(agent, input.dataDir, manifest);
  const wakes = createWakeSources({
    game,
    directions: input.directions,
    clock: input.clock ?? systemClock,
    quietWindowMs: settings.quietWindowMs,
    heartbeatMs: settings.heartbeatMs,
    signal: input.signal,
  });
  const courier = createCourier(agent, wakes, manifest);
  const stop = (reason: StopReason) => stopLoop(reason, agent, manifest);
  let lastSeen = observeWorld(game);
  try {
    let signal: LoopSignal = { kind: "wake", wake: { reason: "startup" } };
    for (let tick = 1; ; tick++) {
      if (signal.kind === "stop") return await stop(signal.reason);
      const current = observeWorld(game);
      const delta = summariseDelta(lastSeen, current);
      const wake = classifyWake(signal.wake, delta);
      if (current.phase === "ended") {
        await recordTick(manifest, tick, wake, delta, true, courier.deliverGameEnded());
        return await stop("game-ended");
      }
      const actionable = isActionable(delta, wake.reason);
      const delivery = actionable ? courier.deliver(wake, delta) : "skipped";
      if (reachedTheModel(delivery)) {
        lastSeen = current;
        wakes.restartHeartbeat();
      }
      await recordTick(manifest, tick, wake, delta, actionable, delivery);
      if (settings.maxTicks !== null && tick >= settings.maxTicks) return await stop("max-ticks");
      signal = await wakes.next();
    }
  } finally {
    wakes.stop();
    courier.dispose();
  }
}

/** A world delta that flipped the phase is a phase change, whichever timer noticed it first. */
const classifyWake = (wake: Wake, delta: WorldDelta): Wake =>
  delta.phase !== null && (wake.reason === "world-delta" || wake.reason === "heartbeat")
    ? { reason: "phase-change" }
    : wake;

const reachedTheModel = (delivery: Delivery): boolean =>
  delivery === "prompted" || delivery === "steered" || delivery === "followed-up";

const recordTick = async (
  manifest: RunManifestRecorder,
  tick: number,
  wake: Wake,
  delta: WorldDelta,
  actionable: boolean,
  delivery: Delivery,
): Promise<void> => {
  manifest.recordTick(wake.reason, actionable, delivery);
  logEvent("agent_runner_tick", { tick, reason: wake.reason, actionable, delivery, deltaSummary: delta });
  await manifest.write();
};

const stopLoop = async (reason: StopReason, agent: Agent, manifest: RunManifestRecorder): Promise<StopReason> => {
  // An interrupted or desynced runner must not finish a plan; a run that ended by rule may say its last word.
  if (reason === "interrupted" || reason === "sync-failed") agent.abort();
  await agent.waitForIdle();
  manifest.finish(reason);
  await manifest.write();
  logEvent("agent_runner_stopped", { reason });
  return reason;
};

// Delivery

interface Courier {
  deliver(wake: Wake, delta: WorldDelta): Delivery;
  deliverGameEnded(): Delivery;
  dispose(): void;
}

/**
 * Hands wakes to the agent the way its state allows: a prompt when idle, a steer for world state mid-run, a follow-up
 * for directions. One world steer is in flight at a time; deltas that arrive while it waits accumulate in `lastSeen`
 * and are delivered as one update once the steer is consumed.
 */
const createCourier = (agent: Agent, wakes: WakeSources, manifest: RunManifestRecorder): Courier => {
  let worldSteerPending = false;
  let coalescedWhilePending = false;

  const unsubscribe = agent.subscribe((event) => {
    if (event.type === "message_end" && event.message.role === "assistant")
      manifest.recordModelCall(event.message.usage);
    if (event.type === "message_end" && isWorldStateUpdate(event.message)) onWorldSteerConsumed();
    if (event.type === "agent_end") {
      logEvent("agent_runner_run_end", {
        messages: agent.state.messages.length,
        error: agent.state.errorMessage ?? null,
      });
    }
  });

  const onWorldSteerConsumed = (): void => {
    worldSteerPending = false;
    if (!coalescedWhilePending) return;
    coalescedWhilePending = false;
    wakes.requestWorldDelta();
  };

  const startRun = (text: string): void => {
    agent.prompt(text).catch((error: unknown) => {
      logEvent("agent_runner_run_failed", { error: error instanceof Error ? error.message : String(error) });
    });
  };

  const steerWorldState = (delta: WorldDelta): Delivery => {
    if (worldSteerPending) {
      coalescedWhilePending = true;
      return "coalesced";
    }
    agent.steer(userMessage(renderWorldStateUpdate(delta)));
    worldSteerPending = true;
    return "steered";
  };

  return {
    deliver: (wake, delta) => {
      if (!agent.state.isStreaming) {
        startRun(renderWakeMessage(wake, delta));
        return "prompted";
      }
      if (wake.reason === "direction") {
        agent.followUp(userMessage(renderWakeMessage(wake, delta)));
        return "followed-up";
      }
      // A heartbeat exists to wake an idle agent; a busy one already has the board in front of it.
      if (wake.reason === "heartbeat") return "coalesced";
      return steerWorldState(delta);
    },
    deliverGameEnded: () => {
      if (!agent.state.isStreaming) {
        startRun(renderGameEndedMessage());
        return "prompted";
      }
      agent.followUp(userMessage(renderGameEndedMessage()));
      return "followed-up";
    },
    dispose: unsubscribe,
  };
};

const isWorldStateUpdate = (message: AgentMessage): boolean =>
  message.role === "user" && messageText(message.content).startsWith(WORLD_STATE_UPDATE_PREFIX);

/** pi stores a prompted string as one text block; a steered message keeps the string it was given. */
const messageText = (content: string | { type: string; text?: string }[]): string =>
  typeof content === "string" ? content : content.map((part) => part.text ?? "").join("");

const userMessage = (content: string): AgentMessage => ({ role: "user", content, timestamp: Date.now() });
