import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { processSeasonTops, type SeasonPorts } from "./season-tops";
const fixture = (count = 3) => {
  const data = new Map<string, unknown>();
  const storage = {
    get: async <T>(key: string) => data.get(key) as T | undefined,
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    delete: async (key: string) => data.delete(key),
    list: async <T>({ prefix, limit, startAfter }: { prefix: string; limit: number; startAfter?: string }) =>
      new Map(
        [...data]
          .filter(([key]) => key.startsWith(prefix) && (!startAfter || key > startAfter))
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(0, limit) as [string, T][],
      ),
  };
  const players = Array.from({ length: count }, (_, i) => `0x${(i + 1).toString(16)}`);
  const season = {
    id: 1,
    participantCount: count,
    paidFraction: 5000,
    topCount: 2,
    allocationCursor: 2,
    posted: false,
    challenged: false,
    settlementStarted: false,
    end: 100,
    reviewUntil: 3700,
  };
  const ports: SeasonPorts = {
    allocate: vi.fn(async (_id, _start) => {
      season.allocationCursor = season.topCount;
      return season.allocationCursor;
    }),
    head: async () => ({ number: 100, hash: "0xa", time: 101 }),
    blockHash: async () => "0xa",
    changes: vi.fn(async (_from, cursor) => {
      const all = [
        { kind: "opened" as const, id: 1 },
        ...players.map((wallet) => ({ kind: "participant" as const, id: 1, wallet })),
      ];
      const offset = Number(cursor ?? 0);
      return {
        rows: all.slice(offset, offset + 100),
        head: 100,
        next: offset + 100 < all.length ? String(offset + 100) : null,
      };
    }),
    posts: vi.fn(async () => ({
      rows: season.posted ? [{ kind: "posted" as const, id: 1, reviewUntil: season.reviewUntil }] : [],
      head: 100,
      next: null,
    })),
    season: async () => season,
    mmr: vi.fn(async (_id, wallet) => (BigInt(wallet) === 1n ? "100" : "200")),
    winner: vi.fn(async (_id, index) => players[index + 1]!),
    post: vi.fn(async (_id, _start, winners) => {
      expect(winners.map(BigInt)).toEqual([2n, 3n]);
      season.posted = true;
      season.topCount = winners.length;
      season.allocationCursor = 0;
    }),
  };
  return {
    data,
    storage,
    ports,
    season,
    tick: (mode: "post" | "audit") => Effect.runPromise(processSeasonTops(mode, ports, storage)),
  };
};
it("posts the complete frozen MMR top list after season end, with wallet-ordered ties and no duplicate post", async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) await f.tick("post");
  expect(f.ports.post).toHaveBeenCalledOnce();
});
it("finds an omitted higher-ranked participant even in a full sorted posted list", async () => {
  const f = fixture();
  f.season.posted = true;
  f.ports.winner = async (_id, index) => (index === 0 ? "0x2" : "0x1");
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await f.tick("audit"));
  expect(results).toContain("season_top_mismatch:1");
});
it("bounds reads, survives recreation, and refuses to leave an incomplete audit past the review boundary", async () => {
  const f = fixture(250);
  f.season.posted = true;
  f.season.topCount = 125;
  f.season.allocationCursor = 125;
  f.ports.changes = async () => ({
    rows: Array.from({ length: 100 }, (_, i) => ({ kind: "participant" as const, id: 1, wallet: `0x${i + 1}` })),
    head: 100,
    next: "more",
  });
  f.ports.head = async () => ({ number: 100, hash: "0xa", time: 3690 });
  expect(await f.tick("audit")).toBe("season_top_unverified:1");
  expect(f.ports.mmr).not.toHaveBeenCalled();
  expect(f.ports.posts).toHaveBeenCalledOnce();
});
it("audits every participant rather than trusting the supplied winners", async () => {
  const f = fixture();
  f.season.posted = true;
  for (let i = 0; i < 5; i++) expect(await f.tick("audit")).toBeNull();
  expect(f.ports.mmr).toHaveBeenCalledTimes(3);
  expect(f.ports.winner).toHaveBeenCalledTimes(2);
});

it("resumes a large population after recreation with one event page and at most100 MMR or winner reads per tick", async () => {
  const f = fixture(250);
  f.season.posted = true;
  f.season.topCount = 125;
  f.season.allocationCursor = 125;
  for (let tick = 0; tick < 9; tick++) {
    const mmr = vi.mocked(f.ports.mmr).mock.calls.length,
      winners = vi.mocked(f.ports.winner).mock.calls.length;
    expect(await Effect.runPromise(processSeasonTops("audit", { ...f.ports }, f.storage))).toBeNull();
    expect(vi.mocked(f.ports.mmr).mock.calls.length - mmr).toBeLessThanOrEqual(100);
    expect(vi.mocked(f.ports.winner).mock.calls.length - winners).toBeLessThanOrEqual(100);
  }
  expect(f.data.get("season:audit:job:1")).toMatchObject({ phase: "done", checked: 250, winnerIndex: 125 });
});
it("pauses while the posted-list stream has unread pages rather than missing a new review window", async () => {
  const f = fixture();
  f.ports.posts = async () => ({ rows: [], head: 100, next: "later-posts" });
  expect(await f.tick("audit")).toBe("season_posts_unverified:100");
});

it("pauses on an RPC failure near a known list's deadline instead of waiting three more ticks", async () => {
  const f = fixture();
  f.season.posted = true;
  await f.tick("audit");
  f.ports.head = async () => ({ number: 100, hash: "0xa", time: 3690 });
  f.ports.winner = async () => {
    throw new Error("rpc_unavailable");
  };
  expect(await f.tick("audit")).toBe("season_top_unavailable:1");
});

it("posts and allocates a large winner list in 32-row transactions without a population cap", async () => {
  const f = fixture(250);
  f.season.topCount = 0;
  f.season.allocationCursor = 0;
  f.ports.post = vi.fn(async (_id, start, wallets) => {
    expect(wallets.length).toBeLessThanOrEqual(32);
    expect(start).toBe(f.season.topCount);
    f.season.topCount += wallets.length;
    f.season.posted = true;
  });
  f.ports.allocate = vi.fn(async (_id, start) => {
    f.season.allocationCursor = Math.min(start + 32, 125);
    return f.season.allocationCursor;
  });
  for (let i = 0; i < 20; i++) await f.tick("post");
  expect(f.ports.post).toHaveBeenCalledTimes(4);
  expect(f.ports.allocate).toHaveBeenCalledTimes(4);
  expect(f.season.allocationCursor).toBe(125);
});
