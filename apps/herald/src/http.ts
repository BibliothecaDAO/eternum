import { buildFrontierLeaderboard } from "./native/frontier-leaderboard";
import type { HeraldGameLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { required, number } from "./native/values";
import { parseStoryHistoryCursor } from "@bibliothecadao/eternum/game-sync";
import { GameFinalizedError } from "./world-fold";
import {
  buildNativeDirectory,
  buildNativeLeaderboard,
  directoryForPlayer,
  directoryStatus,
} from "./native/read-models";
import { type DirectoryInput, type GameDirectorySource } from "./game-directory";
import { seasonDay } from "@bibliothecadao/eternum/expeditions";
import type { GameSnapshot, ReplayMetrics } from "./types";
import type { HistoryQuery, HistoryStore } from "./history-store";
import type { ShardManifest } from "@bibliothecadao/eternum/game-sync";

interface SnapshotSource extends GameDirectorySource {
  snapshot: (
    gameId: string,
    confirmedBlock: number,
    models?: readonly string[],
    actor?: string,
    owner?: string,
  ) => GameSnapshot;
}

interface WorldReadModels {
  directory: (input: DirectoryInput) => ReturnType<typeof buildNativeDirectory>;
  leaderboard: typeof buildNativeLeaderboard;
}

interface HeraldHttpState {
  subscribeConfirmedChanges?: (listener: (models: ReadonlySet<string>) => void) => () => void;
  readModels?: WorldReadModels;
  ingestionFailure?: () => { block: number | null; transactionHash: string; error: string } | undefined;
  chain: string;
  manifest: ShardManifest;
  schemas: Record<string, unknown>;
  worldAddress: string;
  confirmedBlock: () => number;
  chainTimestamp: () => number;
  decodedModelCount: number;
  fold: SnapshotSource;
  metrics: ReplayMetrics;
  history?: Pick<
    HistoryStore,
    "queryStoryCursor" | "queryEvents" | "reviewSnapshot" | "transactionCount" | "activity" | "frontierHistory"
  >;
  undecodableEventCount: () => number;
}

const HISTORY_PAGE_LIMIT = 500;

const PUBLIC_READ_HEADERS = {
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
} as const;

const jsonResponse = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: PUBLIC_READ_HEADERS, status });

const selectModels = (snapshot: GameSnapshot, names: string[]): GameSnapshot => {
  if (names.length === 0) return snapshot;
  const requested = new Set(names);
  const available = new Set(snapshot.models.map(({ model }) => model));
  const missing = [...requested].filter((model) => !available.has(model));
  if (missing.length > 0) throw new Error(`Unknown snapshot models: ${missing.join(", ")}`);
  return { ...snapshot, models: snapshot.models.filter(({ model }) => requested.has(model)) };
};

const requestedModels = (url: URL): string[] =>
  (url.searchParams.get("models") ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

const requestedPlayer = (url: URL): string | undefined => {
  const player = url.searchParams.get("player");
  if (!player) return undefined;
  try {
    const address = BigInt(player);
    if (address > 0n) return `0x${address.toString(16)}`;
  } catch {
    // The stable field error below is more useful than BigInt's parser error.
  }
  throw new Error("Herald directory player must be a positive address");
};

const paginationValue = (url: URL, name: "limit" | "offset", fallback: number): number => {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  const maximum = name === "limit" ? HISTORY_PAGE_LIMIT : Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`Herald history ${name} must be an integer from 0 to ${maximum}`);
  }
  return value;
};

const historyQuery = (url: URL, gameId: string): HistoryQuery => ({
  entityId: url.searchParams.get("entity_id") ?? undefined,
  gameId,
  limit: paginationValue(url, "limit", 100),
  model: url.searchParams.get("model") ?? undefined,
  story: url.searchParams.get("story") ?? undefined,
  offset: paginationValue(url, "offset", 0),
  owner: url.searchParams.get("owner") ?? undefined,
});

export const createHeraldRequestHandler = (state: HeraldHttpState): ((request: Request) => Promise<Response>) => {
  const readModels = state.readModels ?? { directory: buildNativeDirectory, leaderboard: buildNativeLeaderboard };
  const directory = cachedDirectory(state, readModels.directory);
  const leaderboard = cachedLeaderboard(state, readModels.leaderboard);
  const directoryPath = "/games";
  const snapshotPath = /^\/games\/([0-9]+)\/snapshot$/;
  const historyPath = /^\/games\/([0-9]+)\/history$/;
  const reviewSnapshotPath = /^\/games\/([0-9]+)\/review\/snapshot$/;
  const leaderboardPath = /^\/games\/([0-9]+)\/leaderboard$/;
  const transactionCountPath = /^\/games\/([0-9]+)\/transactions\/count$/;

  return async (request) => {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: PUBLIC_READ_HEADERS, status: 204 });
    if (request.method === "GET" && url.pathname === `${directoryPath}/updates`) {
      return streamDirectoryUpdates(request, state, directory.revision);
    }
    if (request.method === "GET" && url.pathname === "/manifest") return jsonResponse(state.manifest);
    if (request.method === "GET" && url.pathname.startsWith("/schemas/")) {
      const identity = url.pathname.slice("/schemas/".length);
      const schema = Object.hasOwn(state.schemas, identity) ? state.schemas[identity] : undefined;
      return schema ? jsonResponse(schema) : jsonResponse({ error: "UNKNOWN_RELEASE_SCHEMA" }, 404);
    }
    if (request.method === "GET" && url.pathname === "/health") {
      const failure = state.ingestionFailure?.();
      return jsonResponse(
        {
          ...(failure ? { ingestion_failure: failure } : {}),
          confirmed_block: state.confirmedBlock(),
          decoded_models: state.decodedModelCount,
          metrics: state.metrics,
          service: "herald",
          success: !failure,
          undecodable_events: state.undecodableEventCount(),
        },
        failure ? 503 : 200,
      );
    }

    if (request.method === "GET" && url.pathname === directoryPath) {
      try {
        return jsonResponse({
          ...directory.read(requestedPlayer(url)),
          world_address: state.worldAddress,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, 400);
      }
    }

    const leaderboardMatch = request.method === "GET" ? leaderboardPath.exec(url.pathname) : null;
    if (leaderboardMatch) {
      try {
        const gameId = leaderboardMatch[1];
        const timestamp = state.chainTimestamp();
        if (timestamp <= 0) return jsonResponse({ error: "chain_clock_unavailable" }, 503);
        return jsonResponse(await leaderboard(gameId, timestamp));
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 503);
      }
    }

    if (request.method === "GET" && url.pathname === "/history/story-events") {
      if (!state.history || state.undecodableEventCount() > 0)
        return jsonResponse({ error: "story_history_unavailable" }, 503);
      let after, limit;
      try {
        after = url.searchParams.has("after") ? parseStoryHistoryCursor(url.searchParams.get("after")) : null;
        limit = paginationValue(url, "limit", 100);
        if (limit < 1) throw new Error("Story page size must be positive");
      } catch {
        return jsonResponse({ error: "invalid_story_cursor" }, 400);
      }
      try {
        return jsonResponse(await state.history.queryStoryCursor(after, limit));
      } catch {
        return jsonResponse({ error: "story_history_unavailable" }, 503);
      }
    }

    const historyMatch = request.method === "GET" ? historyPath.exec(url.pathname) : null;
    if (historyMatch) {
      if (!state.history) return jsonResponse({ error: "history_unavailable" }, 503);
      try {
        return jsonResponse(await state.history.queryEvents(historyQuery(url, historyMatch[1])));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, 400);
      }
    }

    const transactionCountMatch = request.method === "GET" ? transactionCountPath.exec(url.pathname) : null;
    if (transactionCountMatch) {
      if (!state.history) return jsonResponse({ error: "history_unavailable" }, 503);
      return jsonResponse(await state.history.transactionCount(transactionCountMatch[1]));
    }

    const reviewSnapshotMatch = request.method === "GET" ? reviewSnapshotPath.exec(url.pathname) : null;
    if (reviewSnapshotMatch) {
      if (!state.history) return jsonResponse({ error: "history_unavailable" }, 503);
      const snapshot = await state.history.reviewSnapshot(reviewSnapshotMatch[1]);
      return snapshot ? jsonResponse(snapshot) : jsonResponse({ error: "review_snapshot_not_frozen" }, 404);
    }

    const match = request.method === "GET" ? snapshotPath.exec(url.pathname) : null;
    if (!match) return jsonResponse({ error: "not_found" }, 404);

    try {
      const models = requestedModels(url);
      const snapshot = state.fold.snapshot(
        match[1],
        state.confirmedBlock(),
        models,
        url.searchParams.get("actor") ?? undefined,
        url.searchParams.get("owner") ?? undefined,
      );
      return jsonResponse(selectModels(snapshot, models));
    } catch (error) {
      if (error instanceof GameFinalizedError)
        return jsonResponse({ error: "game_finalized", game_id: error.gameId, message: error.message }, 409);
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse({ error: message }, 400);
    }
  };
};

/** Only successful known-game results enter the cache; the next head replaces the entire generation. */
function cachedLeaderboard(state: HeraldHttpState, build: WorldReadModels["leaderboard"]) {
  let block = -1;
  const responses = new Map<string, HeraldGameLeaderboard>();
  return async (requestedGame: string, timestamp: number): Promise<HeraldGameLeaderboard> => {
    const head = state.confirmedBlock();
    if (block !== head) {
      responses.clear();
      block = head;
    }
    const gameId = BigInt(requestedGame).toString();
    const cached = responses.get(gameId);
    if (cached) return cached;
    const rules = required(state.fold.modelRows("SliceRules"), gameId, "SliceRules");
    let response: HeraldGameLeaderboard;
    if (number(rules.epoch_seconds) > 0) {
      if (!state.history || state.undecodableEventCount() > 0) throw new Error("Frontier history unavailable");
      // Capture current facts before awaiting SQL, so a newer head cannot mix into this board.
      const facts = new Map(
        ["GameRegistry", "ChestRules", "Structure"].map((model) => [model, state.fold.modelRows(model)]),
      );
      const history = await state.history.frontierHistory(gameId, head);
      response = buildFrontierLeaderboard((model) => facts.get(model) ?? [], gameId, history);
    } else {
      response = build(state.fold.modelRows, gameId, timestamp, state.history?.activity(gameId) ?? null);
    }
    if (state.confirmedBlock() === head) responses.set(gameId, response);
    return response;
  };
}

/** One cache generation per confirmed head, shared by all readers and directory subscribers. */
function cachedDirectory(state: HeraldHttpState, build: WorldReadModels["directory"]) {
  let block = -1;
  let revision = "";
  let timestamp = -1;
  let foldRevision = -1;
  let response: ReturnType<typeof buildNativeDirectory> | undefined;
  const rows = new Map<string, ReturnType<GameDirectorySource["modelRows"]>>();
  const fold: GameDirectorySource = {
    structurePosition: (game, entity) => state.fold.structurePosition(game, entity),
    directoryRevision: () => state.fold.directoryRevision(),
    modelRows: (model) => {
      let value = rows.get(model);
      if (!value) {
        value = state.fold.modelRows(model);
        rows.set(model, value);
      }
      return value;
    },
  };
  const refresh = () => {
    const nextBlock = state.confirmedBlock();
    const nextTimestamp = state.chainTimestamp();
    const nextFoldRevision = state.fold.directoryRevision();
    if (block === nextBlock && timestamp === nextTimestamp && foldRevision === nextFoldRevision) return;
    if (block !== nextBlock || foldRevision !== nextFoldRevision) rows.clear();
    const nextRevision = `${nextFoldRevision}:${directoryClock({ ...state, fold })}`;
    if (block !== nextBlock || revision !== nextRevision) response = undefined;
    revision = nextRevision;
    block = nextBlock;
    timestamp = nextTimestamp;
    foldRevision = nextFoldRevision;
  };
  return {
    revision: () => {
      refresh();
      return revision;
    },
    read: (playerAddress?: string) => {
      refresh();
      if (!response) {
        response = build({
          chain: state.chain,
          confirmedBlock: block,
          timestamp: state.chainTimestamp(),
          fold,
        });
      }
      return directoryForPlayer(response, {
        chain: state.chain,
        confirmedBlock: block,
        timestamp,
        fold,
        playerAddress,
      });
    },
  };
}

// Empty blocks can cross a start, end or Frontier day without writing any row.
function directoryClock(state: Pick<HeraldHttpState, "chainTimestamp"> & { fold: GameDirectorySource }): string {
  const rules = new Map(
    state.fold.modelRows("SliceRules").map(({ value }) => [BigInt(value.game_id as string).toString(), value]),
  );
  return JSON.stringify(
    state.fold.modelRows("GameRegistry").map(({ value: game }) => {
      const config = rules.get(BigInt(game.game_id as string).toString());
      if (!config) throw new Error(`Missing native SliceRules for game ${game.game_id}`);
      const epochSeconds = Number(config.epoch_seconds);
      const startMainAt = Number(game.start_main_at);
      return [
        directoryStatus(game, state.chainTimestamp()),
        epochSeconds === 0 ? null : seasonDay({ epochSeconds, startMainAt }, state.chainTimestamp()),
      ];
    }),
  );
}

function streamDirectoryUpdates(request: Request, state: HeraldHttpState, revision: () => string): Response {
  if (!state.subscribeConfirmedChanges) return jsonResponse({ error: "directory_stream_unavailable" }, 503);
  try {
    return directoryUpdates(request, state.subscribeConfirmedChanges, revision);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 503);
  }
}

function directoryUpdates(
  request: Request,
  subscribe: NonNullable<HeraldHttpState["subscribeConfirmedChanges"]>,
  revision: () => string,
): Response {
  const message = new TextEncoder().encode("data: changed\n\n");
  let previous = revision();
  let unsubscribe = () => {};
  let close = () => {};
  const cleanup = () => {
    unsubscribe();
    request.signal.removeEventListener("abort", close);
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      close = () => {
        cleanup();
        controller.close();
      };
      if (request.signal.aborted) return close();
      request.signal.addEventListener("abort", close, { once: true });
      unsubscribe = subscribe(() => {
        const current = revision();
        if (current === previous || (controller.desiredSize ?? 0) <= 0) return;
        previous = current;
        controller.enqueue(message);
      });
      // Every connection, including a reconnect, invalidates the previous directory snapshot.
      controller.enqueue(message);
    },
    cancel: cleanup,
  });
  return new Response(stream, {
    headers: {
      ...PUBLIC_READ_HEADERS,
      "content-type": "text/event-stream",
      "x-accel-buffering": "no",
    },
  });
}
