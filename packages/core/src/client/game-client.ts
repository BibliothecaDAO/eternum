import { waitForWorldState } from "./wait-for-world-state";
import { nativeModelDefinition } from "./native-models";
import { nativeSubmission, type NativeClientConnection } from "./native-submission";
import { EternumProvider } from "@bibliothecadao/provider";
import { NativeFactStore } from "./native-fact-store";
import {
  ContractAddress,
  type SystemCallAuthHandler,
  createSystemCalls,
  type SystemCalls,
} from "@bibliothecadao/types";
import type { AccountInterface } from "starknet";

import { resolveGameTransactionResourceBounds } from "../account/transaction-resource-bounds";
import { configManager } from "../managers/config-manager";
import {
  disposeActiveGameSyncRuntime,
  getActiveGameSyncRuntime,
  installFreshGameSyncRuntime,
  SupersededGameSyncStartError,
  type GameSyncRuntime,
} from "../sync/game-sync-runtime";
import type { HeraldGameSyncTransport, HeraldSocket } from "../sync/herald-game-sync-transport";
import type { GameSyncScheduler } from "../sync/scheduler";
import { WorldSpatialProjection } from "../sync/world-spatial-projection";
import { createGameActions, type GameActions } from "./actions";
import { setGameScope } from "./game-scope";
import { createHeraldGameSyncSession, type GameClientObserver } from "./herald-session";
import type { PlayerNameResolver } from "../utils/entities";
import { createGameViews, type GameViews } from "./views";
import { waitForTransactionOutcome } from "./transaction-outcome";
import type { Shard } from "./shard";

export interface GameClientSetup {
  store: NativeFactStore;
  network: { provider: EternumProvider };
  systemCalls: SystemCalls;
}

export interface CreateGameClientInput {
  actor?: string;
  native: NativeClientConnection;
  shard: Shard;
  gameId: number;
  presetId: number;
  authHandler?: SystemCallAuthHandler;
  scheduler: GameSyncScheduler;
  socketFactory?: (url: string) => HeraldSocket;
  observer?: GameClientObserver;
  /** Names players for this client's views: the app's Realms profiles, or a headless client's choice to name no one. */
  playerNames: PlayerNameResolver;
}

export interface GameClient {
  shard: Shard;
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
  input.observer?.onSetupCompleted?.(setupResult);
  const runtime = installFreshGameSyncRuntime();
  try {
    const { projection, transport } = await startSync(runtime, setupResult, input);
    applyGameConfig(setupResult);
    return buildGameClient(input, setupResult, runtime, projection, transport);
  } catch (error) {
    // A superseding session owns the runtime now; anything else leaves a half-started client to tear down.
    if (!(error instanceof SupersededGameSyncStartError)) disposeRuntime(runtime);
    throw error;
  }
}

/** setActiveGame disposes the previous game's runtime, so it must run before this game's session starts. */
const selectGame = ({ gameId, presetId }: CreateGameClientInput): void => {
  configManager.setActiveGame(gameId, presetId);
  setGameScope(gameId);
};

const bootstrapWorld = async ({ shard, gameId, authHandler }: CreateGameClientInput): Promise<GameClientSetup> => {
  const contracts = { world: shard.worldAddress, bridge: shard.contracts.bridge };
  const provider = new EternumProvider(contracts, shard.rpcUrl, undefined, {
    executionResourceBounds: resolveGameTransactionResourceBounds(),
    gameId,
  });
  return {
    store: new NativeFactStore(),
    network: { provider },
    systemCalls: createSystemCalls({ provider, authHandler }),
  };
};

const startSync = async (
  runtime: GameSyncRuntime,
  setupResult: GameClientSetup,
  input: CreateGameClientInput,
): Promise<{ projection: WorldSpatialProjection; transport: HeraldGameSyncTransport }> => {
  const session = createHeraldGameSyncSession({
    actor: input.actor,
    baseUrl: input.shard.url,
    chainId: input.shard.chainId,
    entityModels: input.native.bindings.models.map((model) => model.name),
    eventModels: input.native.bindings.events.map((event) => event.name),
    modelDefinition: nativeModelDefinition(input.native.bindings),
    gameId: input.gameId,
    worldAddress: input.shard.worldAddress,
    observer: input.observer,
    scheduler: input.scheduler,
    store: setupResult.store,
    socketFactory: input.socketFactory,
  });
  session.onDispose = input.native.submitIntent.dispose;
  await runtime.startSession(session);
  // Herald's hello names the confirmed head before any row; a Herald yet to see one sends it on the stream.
  await confirmedChainTime(runtime);
  setupResult.network.provider.setNativeSubmission(
    nativeSubmission(input.native, setupResult.store, input.gameId, input.shard.worldAddress, async (actor) => {
      session.transport.selectActor(actor);
      await waitForWorldState(
        { runtime },
        () => setupResult.store.get("ActionNonce", { game_id: input.gameId, actor: BigInt(actor) }),
        10_000,
        () => "Gameplay nonce from Herald",
      );
    }),
    input.native.bindings.commandAbi,
    (actor) => {
      let owned: number | undefined;
      for (const row of setupResult.store.structuresOwnedBy(input.gameId, BigInt(actor)))
        if (owned === undefined || row.entity_id < owned) owned = row.entity_id;
      if (owned === undefined) throw new Error("Action requires an owned structure in the current game");
      return owned;
    },
  );
  routeTransactionWaitsThroughStream(setupResult, runtime);
  return { projection: installWorldSpatialProjection(runtime, setupResult), transport: session.transport };
};

const CONFIRMED_HEAD_TIMEOUT_MS = 30_000;

/** Chain time must be known before anything reads it: a Frontier realm's site in the first projection build does. */
const confirmedChainTime = (runtime: GameSyncRuntime): Promise<void> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Herald named no confirmed head within ${CONFIRMED_HEAD_TIMEOUT_MS / 1_000} seconds`)),
      CONFIRMED_HEAD_TIMEOUT_MS,
    );
  });
  return Promise.race([runtime.waitForConfirmedHead(), timeout]).finally(() => clearTimeout(timer));
};

/** Herald's stream carries transaction status, so submits wait on the stream instead of polling the RPC. */
const routeTransactionWaitsThroughStream = (setupResult: GameClientSetup, runtime: GameSyncRuntime): void => {
  setupResult.network.provider.setTransactionStreamWaiter(
    (transactionHash, ticket) => waitForTransactionOutcome(runtime, setupResult.store, transactionHash, ticket),
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
  transport: HeraldGameSyncTransport,
): GameClient => {
  let signer: AccountInterface | null = null;
  let views: GameViews | null = null;
  let actions: GameActions | null = null;
  const client: GameClient = {
    shard: input.shard,
    gameId: input.gameId,
    presetId: input.presetId,
    setup: setupResult,
    runtime,
    projection,
    get signer() {
      return signer;
    },
    get views() {
      return (views ??= createGameViews(client, viewerOf(signer), input.playerNames));
    },
    get actions() {
      return (actions ??= createGameActions(client));
    },
    connect: (next) => {
      transport.selectActor(next.address);
      signer = next;
      views = null;
    },
    disconnect: () => {
      transport.selectActor(undefined);
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
