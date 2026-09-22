import { setTimeout as sleep } from "node:timers/promises";
import {
  createGameClient,
  createNativeTicketSubmission,
  setChainProvenTimestampSource,
  setBlockTimestampSource,
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
  actor: string;
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

/** Each player reads and acts through its own Herald subscription and native store. */
export async function connectHarnessGameClient(options: ConnectHarnessGameClientOptions): Promise<GameClient> {
  const world = buildHarnessWorld(options);
  const presetId = await waitForHeraldToListGame(world, options.gameId);
  const clock = createLoggingObserver(options.gameId);
  const client = await createGameClient({
    actor: options.actor,
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
    observer: clock.observer,
  });
  try {
    await clock.ready();
    return client;
  } catch (error) {
    client.dispose();
    throw error;
  }
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

const createLoggingObserver = (gameId: number) => {
  let confirmedTimestamp: number | null = null;
  let onConfirmed: (() => void) | undefined;
  setChainProvenTimestampSource(() => confirmedTimestamp);
  setBlockTimestampSource(() => {
    if (confirmedTimestamp === null) throw new Error("Herald has not supplied a confirmed timestamp");
    return confirmedTimestamp;
  });
  const observer: GameClientObserver = {
    onHead: (head) => {
      if (!head.preconfirmed) {
        confirmedTimestamp = head.timestamp;
        onConfirmed?.();
      }
    },
    onSubscriptionActive: () => console.log(`Game client subscribed to game ${gameId}`),
    onSnapshotPhaseCompleted: (phase, durationMs) =>
      console.log(`Game client snapshot ${phase} completed in ${Math.round(durationMs)} ms`),
    onLiveApplyFailed: (error) => console.error(`Game client live apply failed: ${error.message}`),
  };
  const ready = (): Promise<void> => {
    if (confirmedTimestamp !== null) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        onConfirmed = undefined;
        reject(new Error("Herald did not supply a confirmed timestamp within 10 seconds"));
      }, 10_000);
      onConfirmed = () => {
        clearTimeout(timeout);
        onConfirmed = undefined;
        resolve();
      };
    });
  };
  return { observer, ready };
};
