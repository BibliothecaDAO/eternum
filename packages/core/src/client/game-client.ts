import { nativeModelDefinition } from "./native-models";
import { nativeSubmission, type NativeClientConnection } from "./native-submission";
import { EternumProvider } from "@bibliothecadao/provider";
import { NativeFactStore } from "./native-fact-store";
import {
  ContractAddress,
  type SystemCallAuthHandler,
  createSystemCalls,
  type SystemCalls,
  type Manifest,
} from "@bibliothecadao/types";
import type { AccountInterface, ResourceBoundsBN } from "starknet";

import { configManager } from "../managers/config-manager";
import {
  disposeActiveGameSyncRuntime,
  getActiveGameSyncRuntime,
  installFreshGameSyncRuntime,
  SupersededGameSyncStartError,
  type GameSyncRuntime,
} from "../sync/game-sync-runtime";
import type { HeraldSocket } from "../sync/herald-game-sync-transport";
import type { GameSyncScheduler } from "../sync/scheduler";
import { WorldSpatialProjection } from "../sync/world-spatial-projection";
import { createGameActions, type GameActions } from "./actions";
import { setGameScope } from "./game-scope";
import { createHeraldGameSyncSession, type GameClientObserver } from "./herald-session";
import { createGameViews, type GameViews } from "./views";
import type { WorldDeployment } from "./world-directory";

export interface GameClientSetup {
  store: NativeFactStore;
  network: { provider: EternumProvider };
  systemCalls: SystemCalls;
}

type GameClientSetupEnvironment = { executionResourceBounds?: ResourceBoundsBN };

export interface CreateGameClientInput {
  native: NativeClientConnection;
  world: WorldDeployment;
  gameId: number;
  presetId: number;
  /** The manifest and RPC URL for this deployment. */
  networkConfig: { manifest: Manifest; rpcUrl: string };
  setupEnvironment: GameClientSetupEnvironment;
  authHandler?: SystemCallAuthHandler;
  scheduler: GameSyncScheduler;
  socketFactory?: (url: string) => HeraldSocket;
  observer?: GameClientObserver;
}

export interface GameClient {
  world: WorldDeployment;
  gameId: number;
  presetId: number;
  setup: GameClientSetup;
  runtime: GameSyncRuntime;
  projection: WorldSpatialProjection;
  /** The account that signs this client's actions; null until connect(). */
  readonly signer: AccountInterface | null;
  /**
   * The game seen from the connected signer. Before connect() the client is a spectator: views see the game from no
   * player, so isMine is false everywhere, and any action that submits throws. Callers wanting another viewer use
   * createGameViews directly.
   */
  readonly views: GameViews;
  readonly actions: GameActions;
  connect(signer: AccountInterface): void;
  /** Back to spectating: the next action throws until a signer connects again. */
  disconnect(): void;
  /** Reconnect through the same convergent subscribe → snapshot → replay routine used at boot. */
  recover(): Promise<void>;
  /** Tears down the runtime and its transport, including a subscribe that never resolved. */
  dispose(): void;
}

/** How a client boots a game: the web client's bootstrap and the headless smoke both go through here. */
export async function createGameClient(input: CreateGameClientInput): Promise<GameClient> {
  selectGame(input);
  const setupResult = await bootstrapWorld(input);
  setupResult.network.provider.setNativeSubmission(
    nativeSubmission(input.native, setupResult.store, input.gameId, input.world.worldAddress),
  );
  input.observer?.onSetupCompleted?.(setupResult);
  const runtime = installFreshGameSyncRuntime();
  try {
    const projection = await startSync(runtime, setupResult, input);
    applyGameConfig(setupResult);
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

const bootstrapWorld = async (input: CreateGameClientInput): Promise<GameClientSetup> => {
  const release = (input.networkConfig.manifest as unknown as { native?: { activeSchema: string } }).native;
  if (!release || release.activeSchema !== input.native.bindings.schemaIdentity)
    throw new Error("Native client bindings do not match the deployment");
  const provider = new EternumProvider(input.networkConfig.manifest, input.networkConfig.rpcUrl, "0x0", undefined, {
    executionResourceBounds: input.setupEnvironment.executionResourceBounds,
    namespace: input.world.namespace,
    gameId: input.gameId,
  });
  return {
    store: new NativeFactStore(),
    network: { provider },
    systemCalls: createSystemCalls({ provider, authHandler: input.authHandler }),
  };
};

const startSync = async (
  runtime: GameSyncRuntime,
  setupResult: GameClientSetup,
  input: CreateGameClientInput,
): Promise<WorldSpatialProjection> => {
  await runtime.startSession(
    createHeraldGameSyncSession({
      baseUrl: input.world.heraldBaseUrl,
      chain: input.world.chain,
      entityModels: input.native.bindings.models.map((model) => model.name),
      eventModels: input.native.bindings.events.map((event) => event.name),
      modelDefinition: nativeModelDefinition(input.native.bindings),
      gameId: input.gameId,
      worldAddress: input.world.worldAddress,
      observer: input.observer,
      scheduler: input.scheduler,
      store: setupResult.store,
      socketFactory: input.socketFactory,
    }),
  );
  routeTransactionWaitsThroughStream(setupResult, runtime);
  return installWorldSpatialProjection(runtime, setupResult);
};

/** Herald's stream carries transaction status, so submits wait on the stream instead of polling the RPC. */
const routeTransactionWaitsThroughStream = (setupResult: GameClientSetup, runtime: GameSyncRuntime): void => {
  setupResult.network.provider.setTransactionStreamWaiter(
    (transactionHash) => runtime.waitForTransaction(transactionHash),
    (transactionHash) => runtime.recordSubmittedTransaction(transactionHash),
  );
};

const installWorldSpatialProjection = (
  runtime: GameSyncRuntime,
  setupResult: GameClientSetup,
): WorldSpatialProjection => {
  const projection = new WorldSpatialProjection({
    store: setupResult.store,
  });
  runtime.installWorldSpatialProjection(projection);
  return projection;
};

/** From here on an empty keyed config lookup is a bug, not a sync still in flight. */
const applyGameConfig = (setupResult: GameClientSetup) => {
  configManager.setStore(setupResult.store);
};

const buildGameClient = (
  input: CreateGameClientInput,
  setupResult: GameClientSetup,
  runtime: GameSyncRuntime,
  projection: WorldSpatialProjection,
): GameClient => {
  let signer: AccountInterface | null = null;
  let views: GameViews | null = null;
  let actions: GameActions | null = null;
  const client: GameClient = {
    world: input.world,
    gameId: input.gameId,
    presetId: input.presetId,
    setup: setupResult,
    runtime,
    projection,
    get signer() {
      return signer;
    },
    get views() {
      return (views ??= createGameViews(client, viewerOf(signer)));
    },
    get actions() {
      return (actions ??= createGameActions(client));
    },
    connect: (next) => {
      signer = next;
      views = null;
    },
    disconnect: () => {
      signer = null;
      views = null;
    },
    recover: () => runtime.recover(),
    dispose: () => disposeRuntime(runtime),
  };
  return client;
};

/** A spectator views the game as address zero, which owns nothing. */
const viewerOf = (signer: AccountInterface | null): ContractAddress => ContractAddress(signer?.address ?? 0n);

/** The active-runtime pointer must not outlive its runtime; a runtime that was already replaced just stops. */
const disposeRuntime = (runtime: GameSyncRuntime): void => {
  if (getActiveGameSyncRuntime() === runtime) disposeActiveGameSyncRuntime();
  else runtime.dispose();
};
