import { setup, type DojoSetupConfig, type SetupNetworkEnvironment, type SetupResult } from "@bibliothecadao/dojo";
import type { Config, SystemCallAuthHandler } from "@bibliothecadao/types";
import type { AccountInterface } from "starknet";

import { configManager } from "../managers/config-manager";
import {
  disposeActiveGameSyncRuntime,
  getActiveGameSyncRuntime,
  installFreshGameSyncRuntime,
  SupersededGameSyncStartError,
  type GameSyncRuntime,
} from "../sync/game-sync-runtime";
import type { HeraldSocket } from "../sync/herald-game-sync-transport";
import { getGameSyncModelsForChannel, type GameSyncChannel } from "../sync/model-manifest";
import type { GameSyncScheduler } from "../sync/scheduler";
import { WorldSpatialProjection } from "../sync/world-spatial-projection";
import { isGameScoped, setGameScope } from "./game-scope";
import { createHeraldGameSyncSession, type GameClientObserver } from "./herald-session";
import type { WorldDeployment } from "./world-directory";

/** The setup() inputs a host still owns: the world's VRF provider and the chain's fee bounds. */
type GameClientSetupEnvironment = Pick<SetupNetworkEnvironment, "executionResourceBounds" | "vrfProviderAddress">;

export interface CreateGameClientInput {
  world: WorldDeployment;
  gameId: number;
  presetId: number;
  /** The manifest and RPC url setup() connects with; the host patches the manifest for its world. */
  dojoConfig: DojoSetupConfig;
  setupEnvironment: GameClientSetupEnvironment;
  authHandler?: SystemCallAuthHandler;
  scheduler: GameSyncScheduler;
  socketFactory?: (url: string) => HeraldSocket;
  observer?: GameClientObserver;
  /** The balance config for this game, read once the snapshot is in RECS (the mode flag lives in WorldConfig). */
  resolveGameConfig: (setup: SetupResult) => Config;
}

export interface GameClient {
  world: WorldDeployment;
  gameId: number;
  presetId: number;
  setup: SetupResult;
  runtime: GameSyncRuntime;
  projection: WorldSpatialProjection;
  /** The account that signs this client's transactions; nothing in core reads it until actions land. */
  signer: AccountInterface | null;
  connect(signer: AccountInterface): void;
  /** Reconnect through the same convergent subscribe → snapshot → replay routine used at boot. */
  recover(): Promise<void>;
  /** Tears down the runtime and its transport, including a subscribe that never resolved. */
  dispose(): void;
}

/** How a client boots a game: the web client's bootstrap and the headless smoke both go through here. */
export async function createGameClient(input: CreateGameClientInput): Promise<GameClient> {
  selectGame(input);
  const setupResult = await bootstrapWorld(input);
  input.observer?.onSetupCompleted?.(setupResult);
  const runtime = installFreshGameSyncRuntime();
  try {
    const projection = await startSync(runtime, setupResult, input);
    applyGameConfig(setupResult, input.resolveGameConfig);
    return buildGameClient(input, setupResult, runtime, projection);
  } catch (error) {
    // A superseding session owns the runtime now; anything else leaves a half-started client to tear down.
    if (!(error instanceof SupersededGameSyncStartError)) disposeRuntime(runtime);
    throw error;
  }
}

/** setActiveGame disposes the previous game's runtime, so it must run before this game's session starts. */
const selectGame = ({ world, gameId, presetId }: CreateGameClientInput): void => {
  configManager.setActiveGame(gameId, presetId);
  setGameScope(world.namespace, gameId);
};

const bootstrapWorld = (input: CreateGameClientInput): Promise<SetupResult> =>
  setup(
    input.dojoConfig,
    {
      ...input.setupEnvironment,
      // The provider prepends gameId to every game-system call's calldata on the appchain worlds.
      namespace: input.world.namespace,
      gameId: input.gameId,
      useBurner: false,
    },
    input.authHandler,
  );

const startSync = async (
  runtime: GameSyncRuntime,
  setupResult: SetupResult,
  input: CreateGameClientInput,
): Promise<WorldSpatialProjection> => {
  await runtime.startSession(
    createHeraldGameSyncSession({
      baseUrl: input.world.heraldBaseUrl,
      chain: input.world.chain,
      entityModels: syncModelNames("gamewide-entity"),
      eventModels: syncModelNames("global-event"),
      gameId: input.gameId,
      observer: input.observer,
      scheduler: input.scheduler,
      setup: setupResult,
      socketFactory: input.socketFactory,
    }),
  );
  routeTransactionWaitsThroughStream(setupResult, runtime);
  return installWorldSpatialProjection(runtime, setupResult);
};

const syncModelNames = (channel: GameSyncChannel): string[] =>
  getGameSyncModelsForChannel(channel, { includeS2Only: isGameScoped() }).map(({ name }) => name);

/** Herald's stream carries transaction status, so submits wait on the stream instead of polling the RPC. */
const routeTransactionWaitsThroughStream = (setupResult: SetupResult, runtime: GameSyncRuntime): void => {
  setupResult.network.provider.setTransactionStreamWaiter(
    (transactionHash) => runtime.waitForTransaction(transactionHash),
    (transactionHash) => runtime.recordSubmittedTransaction(transactionHash),
  );
};

const installWorldSpatialProjection = (runtime: GameSyncRuntime, setupResult: SetupResult): WorldSpatialProjection => {
  const projection = new WorldSpatialProjection({
    tileOptComponent: setupResult.network.contractComponents.TileOpt,
    explorerTroopsComponent: setupResult.network.contractComponents.ExplorerTroops,
  });
  runtime.installWorldSpatialProjection(projection);
  return projection;
};

/** From here on an empty keyed config lookup is a bug, not a sync still in flight. */
const applyGameConfig = (setupResult: SetupResult, resolveGameConfig: CreateGameClientInput["resolveGameConfig"]) => {
  configManager.setDojo(setupResult.components, resolveGameConfig(setupResult));
  configManager.markConfigSynced();
};

const buildGameClient = (
  input: CreateGameClientInput,
  setupResult: SetupResult,
  runtime: GameSyncRuntime,
  projection: WorldSpatialProjection,
): GameClient => {
  const client: GameClient = {
    world: input.world,
    gameId: input.gameId,
    presetId: input.presetId,
    setup: setupResult,
    runtime,
    projection,
    signer: null,
    connect: (signer) => {
      client.signer = signer;
    },
    recover: () => runtime.recover(),
    dispose: () => disposeRuntime(runtime),
  };
  return client;
};

/** The active-runtime pointer must not outlive its runtime; a runtime that was already replaced just stops. */
const disposeRuntime = (runtime: GameSyncRuntime): void => {
  if (getActiveGameSyncRuntime() === runtime) disposeActiveGameSyncRuntime();
  else runtime.dispose();
};
