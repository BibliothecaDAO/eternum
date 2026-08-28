import { buildGameDirectory } from "./game-directory";
import type { FoldRow, GameSnapshot, ReplayMetrics } from "./types";

interface SnapshotSource {
  modelRows: (model: string) => FoldRow[];
  snapshot: (gameId: string, confirmedBlock: number) => GameSnapshot;
}

interface HeraldHttpState {
  chain: string;
  confirmedBlock: () => number;
  decodedModelCount: number;
  fold: SnapshotSource;
  metrics: ReplayMetrics;
  undecodableEventCount: () => number;
}

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

export const createHeraldRequestHandler = (state: HeraldHttpState): ((request: Request) => Response) => {
  const escapedChain = state.chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directoryPath = `/${state.chain}/games`;
  const snapshotPath = new RegExp(`^/${escapedChain}/games/([0-9]+)/snapshot$`);

  return (request) => {
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
      return jsonResponse(
        buildGameDirectory({
          chain: state.chain,
          confirmedBlock: state.confirmedBlock(),
          fold: state.fold,
        }),
      );
    }

    const match = request.method === "GET" ? snapshotPath.exec(url.pathname) : null;
    if (!match) return jsonResponse({ error: "not_found" }, 404);

    try {
      const snapshot = state.fold.snapshot(match[1], state.confirmedBlock());
      return jsonResponse(selectModels(snapshot, requestedModels(url)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse({ error: message }, 400);
    }
  };
};
