import { setTimeout as sleep } from "node:timers/promises";
import {
  createGameClient,
  createNativeTicketSubmission,
  setChainProvenTimestampSource,
  resolveGameTransactionResourceBounds,
  type CreateGameClientInput,
  type GameClient,
} from "@bibliothecadao/eternum";
import {
  buildWorldDeployment,
  fetchHeraldGameDirectory,
  type CommittedManifest,
  type GameClientObserver,
  type WorldDeployment,
} from "@bibliothecadao/eternum/game-client";
import { createMicrotaskGameSyncScheduler } from "@bibliothecadao/eternum/game-sync";
import type { Manifest, NativeWorldBindings } from "@bibliothecadao/types";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";

export interface HarnessGameplayContracts {
  bindingAuthorityAddress: string;
  playerAccountClassHash: string;
  playerRegistryAddress: string;
}

interface ConnectHarnessGameClientOptions {
  gameId: number;
  admissionUrl: string;
  chainId: string;
  signIntent: NonNullable<CreateGameClientInput["native"]>["signIntent"];
  gameplayContracts: HarnessGameplayContracts;
  heraldUrl: string;
  manifest: CommittedManifest;
  rpcUrl: string;
}

// Every deployed lab world is the Blitz world; the id only labels the deployment.
const WORLD_ID = "blitz";
const GAME_LISTING_TIMEOUT_MS = 120_000;
const GAME_LISTING_POLL_MS = 2_000;

/** One client per run: the game lives in the native store once, and every bot reads and acts through it. */
export async function connectHarnessGameClient(options: ConnectHarnessGameClientOptions): Promise<GameClient> {
  const world = buildHarnessWorld(options);
  const presetId = await waitForHeraldToListGame(world, options.gameId);
  return createGameClient({
    world,
    gameId: options.gameId,
    presetId,
    networkConfig: { rpcUrl: options.rpcUrl, manifest: options.manifest as unknown as Manifest },
    native: {
      bindings: bindings as unknown as NativeWorldBindings,
      chainId: options.chainId,
      signIntent: options.signIntent,
      submitIntent: createNativeTicketSubmission(options.admissionUrl),
    },
    setupEnvironment: {
      executionResourceBounds: resolveGameTransactionResourceBounds("madara"),
    },
    scheduler: createMicrotaskGameSyncScheduler(),
    observer: createLoggingObserver(options.gameId),
  });
}

const buildHarnessWorld = (options: ConnectHarnessGameClientOptions): WorldDeployment =>
  buildWorldDeployment({
    id: WORLD_ID,
    chain: "madara",
    manifest: options.manifest,
    heraldBaseUrl: options.heraldUrl,
    admissionUrl: options.admissionUrl,
    rpcUrl: options.rpcUrl,
    browserFacing: false,
    playerAccountClassHash: options.gameplayContracts.playerAccountClassHash,
    playerRegistryAddress: options.gameplayContracts.playerRegistryAddress,
    bindingAuthorityAddress: options.gameplayContracts.bindingAuthorityAddress,
  });

/** A game launched moments ago reaches Herald's directory once its registry row is folded; its row carries the preset. */
async function waitForHeraldToListGame(world: WorldDeployment, gameId: number): Promise<number> {
  const deadline = Date.now() + GAME_LISTING_TIMEOUT_MS;
  while (Date.now() <= deadline) {
    const directory = await fetchHeraldGameDirectory(world);
    const game = directory.games.find((candidate) => candidate.game_id === gameId);
    if (game) return game.preset_id;
    await sleep(GAME_LISTING_POLL_MS);
  }
  throw new Error(`Herald did not list game ${gameId} within ${GAME_LISTING_TIMEOUT_MS / 1_000} seconds`);
}

const createLoggingObserver = (gameId: number): GameClientObserver => {
  let confirmedTimestamp: number | null = null;
  setChainProvenTimestampSource(() => confirmedTimestamp);
  return {
  onHead: (head) => { if (!head.preconfirmed) confirmedTimestamp = head.timestamp; },
  onSubscriptionActive: () => console.log(`Game client subscribed to game ${gameId}`),
  onSnapshotPhaseCompleted: (phase, durationMs) =>
    console.log(`Game client snapshot ${phase} completed in ${Math.round(durationMs)} ms`),
  onLiveApplyFailed: (error) => console.error(`Game client live apply failed: ${error.message}`),
  };
};
