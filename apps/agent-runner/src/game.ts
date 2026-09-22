import {
  createGameClient,
  createNativeTicketSubmission,
  setChainProvenTimestampSource,
  type GameClient,
} from "@bibliothecadao/eternum";
import {
  fetchHeraldGameDirectory,
  openShard,
  type GameClientObserver,
  type Shard,
} from "@bibliothecadao/eternum/game-client";
import { createMicrotaskGameSyncScheduler } from "@bibliothecadao/eternum/game-sync";
import type { GameSyncEntity, HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { type NativeWorldBindings, ContractAddress } from "@bibliothecadao/types";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { signRunnerIntent } from "./signer";

import type { RunnerConfig, RunnerGameSelector } from "./config";
import { logEvent } from "./log";

/** A story event as the `events` focus shows it: model names and a clipped payload, never a row store. */
export interface RecentStoryEvent {
  at: number;
  models: string[];
  summary: string;
}

/** The game as the runner holds it: one client and the Herald listing it booted from. */
export interface RunnerGame {
  client: GameClient;
  listing: HeraldGameDirectoryEntry;
  /** The connected signer's address, or zero while spectating. */
  viewer(): ContractAddress;
  recentEvents(): RecentStoryEvent[];
  /** The live stream stopped being trustworthy; the loop stops rather than play on stale rows. */
  onSyncFailed(listener: (error: Error) => void): () => void;
}

const RECENT_EVENT_LIMIT = 50;
const EVENT_SUMMARY_LENGTH = 200;

export async function connectRunnerGame(config: RunnerConfig): Promise<RunnerGame> {
  const shard = await openShard(config.shardUrl, bindings.schemaIdentity);
  const listing = await resolveGameListing(shard, config.game);
  const events = createStoryEventRing();
  const syncFailures = new Set<(error: Error) => void>();
  const client = await createGameClient({
    shard,
    gameId: listing.game_id,
    presetId: listing.preset_id,
    native: {
      bindings: bindings as unknown as NativeWorldBindings,
      chainId: shard.chainId,
      signIntent: (actor, digest) => signRunnerIntent(config, listing.game_id, actor, digest),
      submitIntent: createNativeTicketSubmission(shard.admissionUrl),
    },
    scheduler: createMicrotaskGameSyncScheduler(),
    observer: createRunnerObserver(listing.game_id, events, syncFailures),
  });
  return {
    client,
    listing,
    viewer: () => ContractAddress(client.signer?.address ?? 0n),
    recentEvents: events.list,
    onSyncFailed: (listener) => {
      syncFailures.add(listener);
      return () => syncFailures.delete(listener);
    },
  };
}

/** Herald's directory names the game and carries its preset; an unknown game lists what Herald does know. */
const resolveGameListing = async (shard: Shard, selector: RunnerGameSelector): Promise<HeraldGameDirectoryEntry> => {
  const directory = await fetchHeraldGameDirectory(shard);
  const listing = directory.games.find((game) =>
    "id" in selector ? game.game_id === selector.id : game.name === selector.name,
  );
  if (listing) return listing;
  const known = directory.games.map((game) => `${game.game_id}:${game.name}`).join(", ") || "none";
  throw new Error(`Herald at ${shard.url} does not list game ${describeSelector(selector)}; known: ${known}`);
};

const describeSelector = (selector: RunnerGameSelector): string =>
  "id" in selector ? `id ${selector.id}` : `named "${selector.name}"`;

/**
 * One JSON line per sync milestone, and two side effects the runner needs from the stream: confirmed heads anchor
 * the chain-proven clock production math reads, and story events feed the bounded ring the `events` focus shows.
 */
const createRunnerObserver = (
  gameId: number,
  events: StoryEventRing,
  syncFailures: Set<(error: Error) => void>,
): GameClientObserver => {
  let confirmedHeadTimestamp: number | null = null;
  setChainProvenTimestampSource(() => confirmedHeadTimestamp);
  return {
    onSubscriptionActive: () => logSync("subscribed", { gameId }),
    onSnapshotPhaseCompleted: (phase, durationMs) => logSync("snapshot_phase", { gameId, phase, durationMs }),
    onLiveApplyFailed: (error) => {
      logSync("live_apply_failed", { gameId, error: error.message });
      syncFailures.forEach((listener) => listener(error));
    },
    onHead: (head) => {
      if (!head.preconfirmed) confirmedHeadTimestamp = head.timestamp;
    },
    onStoryEvent: (event) => events.push(event),
    onStoryEventsReset: events.clear,
  };
};

const logSync = (name: string, fields: Record<string, unknown>): void => logEvent(`agent_runner_sync_${name}`, fields);

interface StoryEventRing {
  push(event: GameSyncEntity): void;
  clear(): void;
  list(): RecentStoryEvent[];
}

const createStoryEventRing = (): StoryEventRing => {
  const ring: RecentStoryEvent[] = [];
  return {
    push: (event) => {
      ring.push({ at: Date.now(), models: Object.keys(event.models), summary: summarizeModels(event.models) });
      if (ring.length > RECENT_EVENT_LIMIT) ring.shift();
    },
    clear: () => {
      ring.length = 0;
    },
    list: () => [...ring],
  };
};

const summarizeModels = (models: Record<string, unknown>): string => {
  const text = JSON.stringify(models, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
  return text.length > EVENT_SUMMARY_LENGTH ? `${text.slice(0, EVENT_SUMMARY_LENGTH)}…` : text;
};
