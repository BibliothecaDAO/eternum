import { setTimeout as sleep } from "node:timers/promises";
import {
  createGameClient,
  createNativeTicketSubmission,
  setChainProvenTimestampSource,
  setBlockTimestampSource,
  type CreateGameClientInput,
  type GameClient,
} from "@bibliothecadao/eternum";
import { fetchHeraldGameDirectory, type GameClientObserver, type Shard } from "@bibliothecadao/eternum/game-client";
import { createMicrotaskGameSyncScheduler } from "@bibliothecadao/eternum/game-sync";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";

export interface HarnessGameplayContracts {
  playerAccountClassHash: string;
}

interface ConnectHarnessGameClientOptions {
  actor: string;
  gameId: number;
  shard: Shard;
  signIntent: NonNullable<CreateGameClientInput["native"]>["signIntent"];
}

const GAME_LISTING_TIMEOUT_MS = 120_000;
const GAME_LISTING_POLL_MS = 2_000;

/** Each player reads and acts through its own Herald subscription and native store. */
export async function connectHarnessGameClient(options: ConnectHarnessGameClientOptions): Promise<GameClient> {
  const presetId = await waitForHeraldToListGame(options.shard, options.gameId);
  const clock = createLoggingObserver(options.gameId);
  const client = await createGameClient({
    actor: options.actor,
    shard: options.shard,
    gameId: options.gameId,
    presetId,
    native: {
      bindings: bindings as unknown as NativeWorldBindings,
      chainId: options.shard.chainId,
      signIntent: options.signIntent,
      submitIntent: createNativeTicketSubmission(options.shard.admissionUrl),
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

/** A game launched moments ago reaches Herald's directory once its registry row is folded; its row carries the preset. */
async function waitForHeraldToListGame(world: Shard, gameId: number): Promise<number> {
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
