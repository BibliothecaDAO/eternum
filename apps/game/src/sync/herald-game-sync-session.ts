import type { SetupResult } from "@bibliothecadao/dojo";
import {
  HeraldGameSyncTransport,
  type GameSyncRuntimeMetrics,
  type GameSyncSessionStart,
} from "@bibliothecadao/eternum/game-sync";
import type { GameChain } from "@realms-world/chain";

import { createBrowserScheduler, createRecsGameSyncStore } from "@/dojo/gamewide-sync-adapter";

interface CreateHeraldGameSyncSessionInput {
  baseUrl: string;
  chain: GameChain;
  entityModels: readonly string[];
  eventModels: readonly string[];
  gameId: number;
  logging: boolean;
  onLiveUpdate?: (kind: "entity" | "event") => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onSubscriptionActive?: () => void;
  setup: SetupResult;
}

export function createHeraldGameSyncSession(input: CreateHeraldGameSyncSessionInput): GameSyncSessionStart {
  const syncModels = [...input.entityModels, ...input.eventModels];
  return {
    onLiveUpdate: input.onLiveUpdate,
    onMetrics: input.onMetrics,
    onSubscriptionActive: input.onSubscriptionActive,
    scheduler: createBrowserScheduler(),
    snapshotModels: input.entityModels,
    store: createRecsGameSyncStore(input.setup, input.logging, syncModels),
    transport: new HeraldGameSyncTransport({
      url: buildHeraldGameStreamUrl(input.baseUrl, input.chain, input.gameId),
    }),
  };
}

export function buildHeraldGameStreamUrl(baseUrl: string, chain: GameChain, gameId: number): string {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new Error(`Herald requires a positive game id; received ${gameId}`);
  }

  const url = new URL(baseUrl);
  if (url.protocol === "http:") url.protocol = "ws:";
  else if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error(`Herald requires an HTTP or WebSocket URL; received ${url.protocol}`);
  }

  const prefix = url.pathname.replace(/\/+$/, "");
  url.pathname = `${prefix}/${chain}/games/${gameId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
