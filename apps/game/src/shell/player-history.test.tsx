import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/runtime/world/shards", () => ({ requireOpenShard: async () => undefined }));

import { usePlayerHistory } from "./herald";

const requests: string[] = [];
// The player's history in two pages: the first names a cursor, the second is the last.
vi.stubGlobal("fetch", async (input: string) => {
  requests.push(input);
  const second = new URL(input, "https://app.test").searchParams.get("cursor") === "50:0xa:2";
  return Response.json({
    games: second ? [{ game_id: 1 }] : [{ game_id: 3 }, { game_id: 2 }],
    next: second ? null : "50:0xa:2",
    failures: [],
  });
});

afterEach(() => requests.splice(0));

const historyOf = async (player: string | null) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let games: readonly { game_id: number }[] | undefined;
  const Probe = () => {
    games = usePlayerHistory(player).data;
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  for (let turn = 0; turn < 4; turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  await act(async () => root.unmount());
  return games?.map((game) => game.game_id);
};

it("follows a player's own history to its last page, so a game older than one page is still theirs to read", async () => {
  expect(await historyOf("0x7e")).toEqual([3, 2, 1]);
  expect(requests).toEqual([
    "/api/directory/history?limit=100&player=0x7e",
    "/api/directory/history?limit=100&cursor=50%3A0xa%3A2&player=0x7e",
  ]);
});

it("asks for nothing without a player: the unfiltered history is every game ever settled", async () => {
  expect(await historyOf(null)).toBeUndefined();
  expect(requests).toEqual([]);
});
