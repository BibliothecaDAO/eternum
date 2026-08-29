import { buildGameDirectory } from "./game-directory";
import type { FoldRow, GameSnapshot, ReplayMetrics } from "./types";
import type { HistoryQuery, HistoryStore } from "./history-store";

interface SnapshotSource {
  modelRows: (model: string) => FoldRow[];
  snapshot: (gameId: string, confirmedBlock: number, models?: readonly string[]) => GameSnapshot;
}

interface HeraldHttpState {
  chain: string;
  confirmedBlock: () => number;
  decodedModelCount: number;
  fold: SnapshotSource;
  metrics: ReplayMetrics;
  history?: Pick<HistoryStore, "queryEvents" | "reviewSnapshot" | "transactionCount">;
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
  offset: paginationValue(url, "offset", 0),
  owner: url.searchParams.get("owner") ?? undefined,
});

export const createHeraldRequestHandler = (state: HeraldHttpState): ((request: Request) => Promise<Response>) => {
  const escapedChain = state.chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directoryPath = `/${state.chain}/games`;
  const snapshotPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/snapshot$`);
  const historyPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/history$`);
  const reviewSnapshotPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/review/snapshot$`);
  const transactionCountPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/transactions/count$`);

  return async (request) => {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: PUBLIC_READ_HEADERS, status: 204 });
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        confirmed_block: state.confirmedBlock(),
        decoded_models: state.decodedModelCount,
        metrics: state.metrics,
        service: "herald",
        success: true,
        undecodable_events: state.undecodableEventCount(),
      });
    }

    if (request.method === "GET" && url.pathname === directoryPath) {
      try {
        return jsonResponse(
          buildGameDirectory({
            chain: state.chain,
            confirmedBlock: state.confirmedBlock(),
            fold: state.fold,
            playerAddress: requestedPlayer(url),
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: message }, 400);
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
