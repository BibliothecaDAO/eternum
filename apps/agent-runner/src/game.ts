import { readFile } from "node:fs/promises";
import { getConfigFromNetwork } from "@config";
import {
  createGameClient,
  resolveGameTransactionResourceBounds,
  setChainProvenTimestampSource,
  type CreateGameClientInput,
  type GameClient,
} from "@bibliothecadao/eternum";
import {
  buildWorldDeployment,
  fetchHeraldGameDirectory,
  worldConfigKey,
  type CommittedManifest,
  type GameClientObserver,
  type WorldDeployment,
} from "@bibliothecadao/eternum/game-client";
import { createMicrotaskGameSyncScheduler } from "@bibliothecadao/eternum/game-sync";
import type { GameSyncEntity, HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";

import type { RunnerConfig, RunnerGameSelector } from "./config";

/** A story event as the `events` focus shows it: model names and a clipped payload, never a row store. */
export interface RecentStoryEvent {
  at: number;
  models: string[];
  summary: string;
}

/** The game as the runner holds it: one client, the Herald listing it booted from, and the world's systems. */
export interface RunnerGame {
  client: GameClient;
  listing: HeraldGameDirectoryEntry;
  systems: { blitzRealm: string };
  /** The connected signer's address, or zero while spectating. */
  viewer(): ContractAddress;
  recentEvents(): RecentStoryEvent[];
}

/** The manifest's contracts carry the tag the harness resolves systems by; the world deployment keeps only selectors. */
interface TaggedManifest extends CommittedManifest {
  contracts: { selector: string; address: string; tag: string }[];
}

// Every deployed lab world is the Blitz world; the id only labels the deployment.
const WORLD_ID = "blitz";
const BLITZ_REALM_SYSTEMS_TAG = "s2-blitz_realm_systems";
const RECENT_EVENT_LIMIT = 50;
const EVENT_SUMMARY_LENGTH = 200;

export async function connectRunnerGame(config: RunnerConfig): Promise<RunnerGame> {
  const manifest = await readCommittedManifest(config.manifestPath);
  const world = buildRunnerWorld(config, manifest);
  const listing = await resolveGameListing(world, config.game);
  const events = createStoryEventRing();
  const client = await createGameClient({
    world,
    gameId: listing.game_id,
    presetId: listing.preset_id,
    dojoConfig: { rpcUrl: config.rpcUrl, manifest },
    setupEnvironment: {
      vrfProviderAddress: "0x0",
      executionResourceBounds: resolveGameTransactionResourceBounds(config.chain),
    },
    scheduler: createMicrotaskGameSyncScheduler(),
    observer: createRunnerObserver(listing.game_id, events),
    resolveGameConfig: resolveGameConfig(config),
  });
  return {
    client,
    listing,
    systems: { blitzRealm: requireContract(manifest, BLITZ_REALM_SYSTEMS_TAG) },
    viewer: () => ContractAddress(client.signer?.address ?? 0n),
    recentEvents: events.list,
  };
}

const readCommittedManifest = async (manifestPath: string): Promise<TaggedManifest> => {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8")) as TaggedManifest;
  } catch (error) {
    throw new Error(`Cannot read the world manifest at ${manifestPath}`, { cause: error });
  }
};

const buildRunnerWorld = (config: RunnerConfig, manifest: CommittedManifest): WorldDeployment =>
  buildWorldDeployment({
    id: WORLD_ID,
    chain: config.chain,
    manifest,
    heraldBaseUrl: config.heraldUrl,
    rpcUrl: config.rpcUrl,
    browserFacing: false,
    playerAccountClassHash: config.playerAccountClassHash,
    playerRegistryAddress: config.playerRegistryAddress,
    bindingAuthorityAddress: config.bindingAuthorityAddress,
  });

/** Herald's directory names the game and carries its preset; an unknown game lists what Herald does know. */
const resolveGameListing = async (
  world: WorldDeployment,
  selector: RunnerGameSelector,
): Promise<HeraldGameDirectoryEntry> => {
  const directory = await fetchHeraldGameDirectory(world);
  const listing = directory.games.find((game) =>
    "id" in selector ? game.game_id === selector.id : game.name === selector.name,
  );
  if (listing) return listing;
  const known = directory.games.map((game) => `${game.game_id}:${game.name}`).join(", ") || "none";
  throw new Error(`Herald at ${world.heraldBaseUrl} does not list game ${describeSelector(selector)}; known: ${known}`);
};

const describeSelector = (selector: RunnerGameSelector): string =>
  "id" in selector ? `id ${selector.id}` : `named "${selector.name}"`;

const requireContract = (manifest: TaggedManifest, tag: string): string => {
  const contract = manifest.contracts.find((candidate) => candidate.tag === tag);
  if (!contract) throw new Error(`World manifest has no contract tagged ${tag}`);
  return contract.address;
};

/** The balance config the client's managers read; the mode flag is on WorldConfig once the snapshot landed. */
const resolveGameConfig =
  (config: RunnerConfig): CreateGameClientInput["resolveGameConfig"] =>
  (setup) => {
    const worldConfig = getComponentValue(setup.components.WorldConfig, worldConfigKey());
    return getConfigFromNetwork(config.chain, worldConfig?.blitz_mode_on ? "blitz" : "eternum");
  };

/**
 * One JSON line per sync milestone, and two side effects the runner needs from the stream: confirmed heads anchor
 * the chain-proven clock production math reads, and story events feed the bounded ring the `events` focus shows.
 */
const createRunnerObserver = (gameId: number, events: StoryEventRing): GameClientObserver => {
  let confirmedHeadTimestamp: number | null = null;
  setChainProvenTimestampSource(() => confirmedHeadTimestamp);
  return {
    onSubscriptionActive: () => logSync("subscribed", { gameId }),
    onSnapshotPhaseCompleted: (phase, durationMs) => logSync("snapshot_phase", { gameId, phase, durationMs }),
    onLiveApplyFailed: (error) => logSync("live_apply_failed", { gameId, error: error.message }),
    onHead: (head) => {
      if (!head.preconfirmed) confirmedHeadTimestamp = head.timestamp;
    },
    onStoryEvent: (event) => events.push(event),
    onStoryEventsReset: events.clear,
  };
};

const logSync = (name: string, fields: Record<string, unknown>): void => {
  console.log(JSON.stringify({ event: `agent_runner_sync_${name}`, ...fields }));
};

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
