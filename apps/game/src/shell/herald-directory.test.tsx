import playerAccount from "../../../../contracts/l3/player-account/class-hash.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const shardReads = vi.hoisted(() => ({
  open: vi.fn(async () => ({ url: "https://herald.test/" })),
}));
vi.mock("@/runtime/world/shards", () => ({ requireOpenShard: shardReads.open }));

// Staging's guardian and account class, and a Realms id whose account they place at `PLAYER`.
const GUARDIAN = {
  publicKey: "0x20b94f1f60aabd0d7538bc5d78b95829603d1c969220385992772be5283ca76",
  accountClassHash: playerAccount.accountClassHash,
};
const REALMS_ID = "0x4dcca33a9dcd23f3d11f33c2082297968809f3600f2ea26493e52000233bac8";
const PLAYER = "0x7135b0375449f4d4ba792fb0ed683f501002ec64aa8c742dc90071b5f014992";

const requests: string[] = [];
const guardianAnswer = vi.hoisted(() => ({ release: () => {} }));
vi.stubGlobal("fetch", async (input: string) => {
  requests.push(input);
  if (input === "/api/guardian") {
    // The guardian answers late, as it does on a cold load.
    await new Promise<void>((resolve) => (guardianAnswer.release = resolve));
    return Response.json(GUARDIAN);
  }
  if (input.startsWith("/api/directory/history?")) {
    return Response.json({
      games: [{ game_id: 7, chainId: "0x1", mode: "frontier", status: "Settled" }],
      next: null,
      failures: [],
    });
  }
  if (input.startsWith("/api/directory")) return Response.json({ shard: null });
  if (input === "https://herald.test/games/4/leaderboard") {
    return Response.json({ error: "season_one_ranks_aspects" }, { status: 404 });
  }
  if (input === "https://herald.test/games/5/leaderboard") {
    return new Response("", { status: 503 });
  }
  return new Response(null, { status: 401 });
});

import type { GameRef } from "@bibliothecadao/eternum/shard";
import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { retryTransientRead } from "@/runtime/app-api";
import { type DirectoryGame, useDirectory, useLeaderboard, useRecentResults } from "./herald";

// The app's first session load keeps whatever session a test set.
vi.spyOn(identityClient, "getSession").mockImplementation(async () => useIdentitySessionStore.getState().session);

const seen: { pending: boolean[] } = { pending: [] };
const Probe = () => {
  const directory = useDirectory();
  useEffect(() => {
    seen.pending.push(directory.isPending);
  });
  return null;
};

afterEach(() => {
  requests.splice(0);
  seen.pending = [];
  shardReads.open.mockClear();
  useIdentitySessionStore.setState({ status: "anonymous", session: null });
});

/** Lets the read settle on real time, a few seconds at most, however loaded the machine running the test is. */
const settled = async () => {
  for (let waited = 0; waited < 5_000 && seen.pending.at(-1); waited += 25) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 25)));
  }
};

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  return () => act(async () => root.unmount());
};

it("reads a signed-in player's directory only once their account address is known, never the anonymous one first", async () => {
  useIdentitySessionStore.setState({
    status: "signed-in",
    session: {
      session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
      user: { id: "u", realmsId: REALMS_ID, name: "NightTester", email: "a@example.invalid" },
    },
  });
  const unmount = await mount();
  try {
    await act(async () => {});
    expect(requests.filter((url) => url.startsWith("/api/directory"))).toEqual([]);
    expect(seen.pending.at(-1)).toBe(true);

    await act(async () => guardianAnswer.release());
    await settled();
    expect(requests.filter((url) => url.startsWith("/api/directory"))).toEqual([`/api/directory?player=${PLAYER}`]);
    expect(seen.pending.at(-1)).toBe(false);
  } finally {
    await unmount();
  }
});

it("waits for the session before any read, then reads the anonymous directory for nobody", async () => {
  useIdentitySessionStore.setState({ status: "loading", session: null });
  const unmount = await mount();
  try {
    await act(async () => {});
    expect(requests.filter((url) => url.startsWith("/api/directory"))).toEqual([]);
    await act(async () => useIdentitySessionStore.setState({ status: "anonymous", session: null }));
    await settled();
    expect(requests.filter((url) => url.startsWith("/api/directory"))).toEqual(["/api/directory"]);
  } finally {
    await unmount();
  }
});

const mountLeaderboard = async (game: GameRef | DirectoryGame | null) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let latest: ReturnType<typeof useLeaderboard> | undefined;
  const LeaderboardProbe = () => {
    latest = useLeaderboard(game);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: retryTransientRead, retryDelay: 0 } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <LeaderboardProbe />
      </QueryClientProvider>,
    ),
  );
  const wait = async () => {
    for (let waited = 0; waited < 5_000 && latest?.fetchStatus === "fetching"; waited += 25) {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 25)));
    }
  };
  return { read: () => latest!, wait, unmount: () => act(async () => root.unmount()) };
};

it("skips the Season 0 leaderboard for an Aspect directory game without opening a shard", async () => {
  const aspectSeason: DirectoryGame = {
    chainId: "0x1",
    game_id: 4,
    mode: "frontier",
    name: "Frontier",
    status: "Live",
    clock_scale: 1,
    dev_mode_on: false,
    expedition: null,
    clock: { start_main_at: 100, start_settling_at: 90, scheduled_end_at: 200, end_at: 200 },
    registration: { count: 10, max: 100, start_at: 80 },
    player_count: 10,
    settled_realms_count: 10,
    settled_villages_count: 0,
    settlement: null,
    season_number: 1,
    aspect_members: { 1: 3, 2: 3, 3: 2, 4: 2 },
    aspect_race: { finish_height: 7_500, season_days: 30, heights: { 1: 100, 2: 0, 3: 0, 4: 0 } },
    player_state: null,
  };
  const probe = await mountLeaderboard(aspectSeason);
  try {
    await probe.wait();
    expect(shardReads.open).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
    expect(probe.read().data).toBeUndefined();
    expect(probe.read().isError).toBe(false);
  } finally {
    await probe.unmount();
  }
});

it("resolves null without retrying when a bare GameRef hits Herald's season_one_ranks_aspects 404", async () => {
  const probe = await mountLeaderboard({ chainId: "0x1", gameId: 4 });
  try {
    await probe.wait();
    expect(requests.filter((url) => url.endsWith("/games/4/leaderboard"))).toHaveLength(1);
    expect(probe.read().data).toBeNull();
    expect(probe.read().isError).toBe(false);
  } finally {
    await probe.unmount();
  }
});

it("surfaces an error when a bare GameRef leaderboard fails with 503", async () => {
  const probe = await mountLeaderboard({ chainId: "0x1", gameId: 5 });
  try {
    await probe.wait();
    expect(requests.filter((url) => url.endsWith("/games/5/leaderboard"))).toHaveLength(2);
    expect(probe.read().isError).toBe(true);
  } finally {
    await probe.unmount();
  }
});

it("requests Frontier history in a single query with mode=frontier", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let latest: ReturnType<typeof useRecentResults> | undefined;
  const HistoryProbe = () => {
    latest = useRecentResults(8, PLAYER, true, "frontier");
    return null;
  };
  const root = createRoot(document.createElement("div"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <HistoryProbe />
      </QueryClientProvider>,
    ),
  );
  try {
    for (let waited = 0; waited < 5_000 && latest?.isPending; waited += 25) {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 25)));
    }
    expect(latest?.data?.games.map((game) => game.game_id)).toEqual([7]);
    expect(requests.filter((url) => url.startsWith("/api/directory/history?"))).toEqual([
      `/api/directory/history?limit=8&player=${PLAYER}&mode=frontier`,
    ]);
  } finally {
    await act(async () => root.unmount());
  }
});
