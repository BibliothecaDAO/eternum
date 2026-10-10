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
    posted: false,
    challenged: false,
    settlementStarted: false,
    end: 100,
    reviewUntil: 3700,
  };
  const ports: SeasonPorts = {
    challenge: vi.fn(async () => {
      season.challenged = true;
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
    post: vi.fn(async (_id, winners) => {
      expect(winners.map(BigInt)).toEqual([2n, 3n]);
      season.posted = true;
      season.topCount = winners.length;
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
it("challenges the season when a full sorted list omits a higher-ranked participant", async () => {
  const f = fixture();
  f.season.posted = true;
  f.ports.winner = async (_id, index) => (index === 0 ? "0x2" : "0x1");
  expect(await f.tick("audit")).toBe("season_challenged:1");
  expect(f.ports.challenge).toHaveBeenCalledWith(1, expect.any(String));
  expect(BigInt(vi.mocked(f.ports.challenge).mock.calls[0]![1])).toBe(3n);
  expect(f.ports.post).not.toHaveBeenCalled();
  await f.tick("audit");
  expect(f.ports.challenge).toHaveBeenCalledOnce();
});
it("checks every participant independently and leaves a matching season alone", async () => {
  const f = fixture();
  f.season.posted = true;
  for (let i = 0; i < 5; i++) expect(await f.tick("audit")).toBeNull();
  expect(f.ports.mmr).toHaveBeenCalledTimes(3);
  expect(f.ports.winner).toHaveBeenCalledTimes(2);
  expect(f.ports.challenge).not.toHaveBeenCalled();
});
it("waits for the complete history before computing a list", async () => {
  const f = fixture();
  f.ports.posts = async () => ({ rows: [], head: 100, next: "later-posts" });
  expect(await f.tick("audit")).toBe("season_history_pending");
  expect(f.ports.mmr).not.toHaveBeenCalled();
  expect(f.ports.challenge).not.toHaveBeenCalled();
});
it("reports unavailable MMR without inventing a challenge", async () => {
  const f = fixture();
  f.season.posted = true;
  f.ports.mmr = async () => {
    throw new Error("rpc_unavailable");
  };
  await expect(f.tick("audit")).rejects.toMatchObject({ operation: "season_audit" });
  expect(f.ports.challenge).not.toHaveBeenCalled();
});
it("posts the complete top from 2,000 participants in one transaction without retaining ratings", async () => {
  const f = fixture(2000);
  f.ports.post = vi.fn(async (_id, wallets) => {
    expect(wallets).toHaveLength(1000);
    f.season.topCount = wallets.length;
    f.season.posted = true;
  });
  for (let tick = 0; tick < 25; tick++) await f.tick("post");
  expect(f.ports.post).toHaveBeenCalledOnce();
  expect(f.ports.mmr).toHaveBeenCalledTimes(2000);
  expect([...f.data.keys()].some((key) => key.startsWith("season:score:") || key.startsWith("season:top:"))).toBe(
    false,
  );
});
it("rejects incomplete population and a changed source head", async () => {
  const f = fixture();
  f.season.participantCount = 4;
  await expect(f.tick("post")).rejects.toThrow();
  expect(f.ports.post).not.toHaveBeenCalled();
  f.season.participantCount = 3;
  f.ports.blockHash = async () => "0xb";
  await expect(f.tick("post")).rejects.toThrow();
  expect(f.ports.post).not.toHaveBeenCalled();
});
