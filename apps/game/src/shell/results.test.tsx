import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const requests = vi.hoisted(() => [] as string[]);
vi.hoisted(() =>
  vi.stubGlobal("fetch", async (input: string) => {
    requests.push(input);
    const game = (id: number, end: number) => ({
      game_id: id,
      name: `blitz-${id}`,
      mode: "blitz",
      status: "Settled",
      player_count: 24,
      clock: { end_at: end },
      chainId: "0xa",
      shardUrl: "https://shard-a.test",
    });
    if (input.startsWith("/api/directory/history")) {
      const cursor = new URL(input, "https://app.test").searchParams.get("cursor");
      return Response.json(
        cursor === "page-2"
          ? { games: [game(1, 100)], next: null, failures: [] }
          : {
              games: [game(3, 300), game(2, 200)],
              next: "page-2",
              failures: [{ url: "https://shard-b.test", error: "unavailable" }],
            },
      );
    }
    if (input.startsWith("/api/directory")) return Response.json({ shards: [] });
    return new Response(null, { status: 401 });
  }),
);
vi.mock("@/runtime/world/shards", () => ({
  listPastedShards: () => [],
  openPastedShards: async () => [],
  requireOpenShard: async () => {
    throw new Error("not needed");
  },
}));
vi.mock("./standings", () => ({ Standings: () => <p>standings</p> }));

import { ResultsPage } from "./results";

it("pages through the history: settled games newest first, load more until the last page, and names a missing shard", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  const root = createRoot(container);
  const settle = async () => {
    for (let tick = 0; tick < 8; tick += 1) await act(async () => {});
  };
  const names = () => [...container.querySelectorAll("summary b")].map((node) => node.textContent);
  const loadMore = () => [...container.querySelectorAll("button")].find((node) => node.textContent === "Load more");
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ResultsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await settle();
  try {
    expect(names()).toEqual(["blitz-3", "blitz-2"]);
    expect(container.textContent).toContain("Results from shard-b.test are unavailable right now.");
    expect(requests).toContain("/api/directory/history?limit=20");
    await act(async () => loadMore()!.click());
    await settle();
    expect(names()).toEqual(["blitz-3", "blitz-2", "blitz-1"]);
    expect(requests).toContain("/api/directory/history?limit=20&cursor=page-2");
    expect(loadMore()).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
  }
});
