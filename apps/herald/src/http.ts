import { parseStoryHistoryCursor } from "@bibliothecadao/eternum/game-sync";
import { buildLiveLeaderboard } from "./live-leaderboard";
import { buildGameDirectory, type DirectoryInput } from "./game-directory";
import type { FoldRow, GameSnapshot, ReplayMetrics } from "./types";
import type { HistoryQuery, HistoryStore } from "./history-store";

interface SnapshotSource {
  modelRows: (model: string) => FoldRow[];
  snapshot: (gameId: string, confirmedBlock: number, models?: readonly string[]) => GameSnapshot;
}

export interface WorldReadModels {
  directory: (input: DirectoryInput) => ReturnType<typeof buildGameDirectory>;
  leaderboard: typeof buildLiveLeaderboard;
}

interface HeraldHttpState {
  subscribeConfirmedChanges?: (listener: (models: ReadonlySet<string>) => void) => () => void;
  readModels?: WorldReadModels;
  ingestionFailure?: () => { block: number | null; transactionHash: string; error: string } | undefined;
  chain: string;
  worldAddress: string;
  confirmedBlock: () => number;
  chainTimestamp: () => number;
  decodedModelCount: number;
  fold: SnapshotSource;
  metrics: ReplayMetrics;
  history?: Pick<
    HistoryStore,
    "queryStoryCursor" | "queryEvents" | "reviewSnapshot" | "transactionCount" | "leaderboard"
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
  const readModels = state.readModels ?? { directory: buildGameDirectory, leaderboard: buildLiveLeaderboard };
  const escapedChain = state.chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directoryPath = `/${state.chain}/games`;
  const snapshotPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/snapshot$`);
  const historyPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/history$`);
  const reviewSnapshotPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/review/snapshot$`);
  const leaderboardPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/leaderboard$`);
  const transactionCountPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/transactions/count$`);

  return async (request) => {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: PUBLIC_READ_HEADERS, status: 204 });
    if (request.method === "GET" && url.pathname === `${directoryPath}/updates`) {
      return streamDirectoryUpdates(request, state, readModels.directory);
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
          ...readModels.directory({
            timestamp: state.chainTimestamp(),
            chain: state.chain,
            confirmedBlock: state.confirmedBlock(),
            fold: state.fold,
            playerAddress: requestedPlayer(url),
          }),
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
        return jsonResponse(
          readModels.leaderboard(state.fold.modelRows, gameId, timestamp, state.history?.leaderboard(gameId) ?? null),
        );
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 503);
      }
    }

    if (request.method === "GET" && url.pathname === `/${state.chain}/history/story-events`) {
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
      const snapshot = state.fold.snapshot(match[1], state.confirmedBlock(), models);
      return jsonResponse(selectModels(snapshot, models));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse({ error: message }, 400);
    }
  };
};

function streamDirectoryUpdates(
  request: Request,
  state: HeraldHttpState,
  buildDirectory: WorldReadModels["directory"],
): Response {
  if (!state.subscribeConfirmedChanges) return jsonResponse({ error: "directory_stream_unavailable" }, 503);
  // The directory's actual row reads define its dependencies for either deployment codec.
  const dependencies = new Set<string>();
  try {
    buildDirectory({
      chain: state.chain,
      timestamp: state.chainTimestamp(),
      confirmedBlock: state.confirmedBlock(),
      fold: {
        modelRows: (model) => {
          dependencies.add(model);
          return state.fold.modelRows(model);
        },
      },
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 503);
  }
  return directoryUpdates(request, state.subscribeConfirmedChanges, dependencies);
}

function directoryUpdates(
  request: Request,
  subscribe: NonNullable<HeraldHttpState["subscribeConfirmedChanges"]>,
  dependencies: ReadonlySet<string>,
): Response {
  const message = new TextEncoder().encode("data: changed\n\n");
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
      unsubscribe = subscribe((models) => {
        if ((controller.desiredSize ?? 0) <= 0) return;
        if ([...models].some((model) => dependencies.has(model))) controller.enqueue(message);
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
