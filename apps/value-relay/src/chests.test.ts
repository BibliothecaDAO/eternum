import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { DurableChestStore, finishChestNow, finishRequestedChests } from "./chests";
import { RelayFailure, type ChestPorts, type ChestPage, type ChestRequest } from "./ports";

/** The block the fake ledger reader starts a scan at, as the real one starts at the ledger's deployment block. */
const DEPLOYED = 90;

const fixture = () => {
  let cursor: { fromBlock?: number; page: string | null } = { page: null };
  const requests = new Map<string, ChestRequest>();
  const request = { tokenId: "7", requester: "0x123", requestBlock: 100 };
  const store = {
    cursor: async () => cursor,
    observe: async (page: ChestPage) => {
      for (const row of page.rows) {
        if (row.kind === "requested") requests.set(row.request.tokenId, row.request);
        else requests.delete(row.tokenId);
      }
      cursor = { fromBlock: page.next === null ? page.head + 1 : page.fromBlock, page: page.next };
    },
    pending: async () => [...requests.values()],
    complete: async (id: string) => {
      requests.delete(id);
    },
  };
  const ports: ChestPorts = {
    changes: (from) =>
      Effect.succeed({
        rows: from === undefined ? [{ kind: "requested", request }] : [],
        head: 110,
        anchor: { number: 110, hash: "0xa" },
        rewind: false,
        next: null,
        fromBlock: from ?? DEPLOYED,
      }),
    head: () => Effect.succeed(110),
    chest: () => Effect.succeed({ requested: true, finished: false, requester: "0x123", requestBlock: 100 }),
    finish: vi.fn(() => Effect.void),
  };
  return { ports, store, request };
};
it("waits until B+11, then finishes once and advances its discovery cursor", async () => {
  const f = fixture();
  await Effect.runPromise(finishRequestedChests(f.ports, f.store));
  expect(f.ports.finish).not.toHaveBeenCalled();
  f.ports.head = () => Effect.succeed(111);
  await Effect.runPromise(finishRequestedChests(f.ports, f.store));
  await Effect.runPromise(finishRequestedChests(f.ports, f.store));
  expect(f.ports.finish).toHaveBeenCalledOnce();
  expect(await f.store.pending()).toEqual([]);
});
it("retains failed finishes and recognizes a finish landed before a lost acknowledgment", async () => {
  const f = fixture();
  f.ports.head = () => Effect.succeed(111);
  f.ports.finish = vi.fn(() => Effect.fail(new RelayFailure({ operation: "lost_ack" })));
  expect(await Effect.runPromise(finishRequestedChests(f.ports, f.store))).toMatchObject({ failed: 1 });
  expect(await f.store.pending()).toHaveLength(1);
  f.ports.chest = () => Effect.succeed({ requested: true, finished: true, requester: "0x123", requestBlock: 100 });
  await Effect.runPromise(finishRequestedChests(f.ports, f.store));
  expect(f.ports.finish).toHaveBeenCalledOnce();
  expect(await f.store.pending()).toEqual([]);
});
it("completed historical events leave no pending work", async () => {
  const f = fixture();
  f.ports.changes = () =>
    Effect.succeed({
      rows: [
        { kind: "requested", request: f.request },
        { kind: "finished", tokenId: "7" },
      ],
      head: 111,
      anchor: { number: 111, hash: "0xa" },
      rewind: false,
      next: null,
      fromBlock: DEPLOYED,
    });
  await Effect.runPromise(finishRequestedChests(f.ports, f.store));
  expect(f.ports.finish).not.toHaveBeenCalled();
});
it("finishes two pages across a restart without losing queued requests or rereading history", async () => {
  const { data, storage } = storageFixture();
  const f = fixture();
  f.ports.head = () => Effect.succeed(111);
  f.ports.changes = vi.fn((from, token) =>
    Effect.succeed({
      rows: Array.from({ length: 20 }, (_, index) => ({
        kind: "requested" as const,
        request: { ...f.request, tokenId: String(index + (token ? 20 : 0)) },
      })),
      head: 111,
      anchor: { number: 111, hash: "0xa" },
      rewind: false,
      next: token ? null : "next-page",
      fromBlock: from ?? DEPLOYED,
    }),
  );
  await Effect.runPromise(
    finishRequestedChests(f.ports, new DurableChestStore(storage as unknown as DurableObjectStorage)),
  );
  expect(f.ports.changes).toHaveBeenCalledOnce();
  expect(f.ports.finish).toHaveBeenCalledTimes(20);
  await Effect.runPromise(
    finishRequestedChests(f.ports, new DurableChestStore(storage as unknown as DurableObjectStorage)),
  );
  expect(f.ports.changes).toHaveBeenLastCalledWith(DEPLOYED, "next-page", { number: 111, hash: "0xa" });
  expect(f.ports.finish).toHaveBeenCalledTimes(40);
  expect(new Set(vi.mocked(f.ports.finish).mock.calls.map(([id]) => id)).size).toBe(40);
  expect([...data.keys()].some((key) => key.startsWith("chests:request:"))).toBe(false);
  expect(data.get("chests:cursor")).toEqual({ fromBlock: 112, page: null, anchor: { number: 111, hash: "0xa" } });
});

it("rotates a bounded pending page through a large backlog after recreation", async () => {
  const data = new Map<string, unknown>();
  for (let i = 0; i < 80; i++)
    data.set(`chests:request:${String(i).padStart(3, "0")}`, {
      tokenId: String(i),
      requester: "0x123",
      requestBlock: 100,
    });
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    list: async ({ prefix, limit, startAfter }: { prefix: string; limit: number; startAfter?: string }) =>
      new Map(
        [...data]
          .filter(([key]) => key.startsWith(prefix) && (!startAfter || key > startAfter))
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(0, limit),
      ),
  };
  const first = await new DurableChestStore(storage as unknown as DurableObjectStorage).pending();
  const second = await new DurableChestStore(storage as unknown as DurableObjectStorage).pending();
  expect(first).toHaveLength(25);
  expect(second).toHaveLength(25);
  expect(first.some((row) => second.some((next) => next.tokenId === row.tokenId))).toBe(false);
});

const storageFixture = () => {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    delete: async (key: string) => data.delete(key),
    list: async ({ prefix, limit }: { prefix: string; limit: number }) =>
      new Map([...data].filter(([key]) => key.startsWith(prefix)).slice(0, limit)),
    transaction: async (run: (tx: unknown) => Promise<void>) => run(storage),
  };
  return { data, storage };
};

it("rebuilds the pending queue from canonical events after a rewrite, across a restart", async () => {
  const { data, storage } = storageFixture();
  const f = fixture();
  data.set("chests:cursor", { fromBlock: 1001, page: null, anchor: { number: 1000, hash: "0xdead" } });
  data.set("chests:request:orphan", { ...f.request, tokenId: "orphan" });
  data.set("chests:queue-cursor", "chests:request:orphan");
  f.ports.head = () => Effect.succeed(111);
  f.ports.changes = vi.fn((from, page) =>
    Effect.succeed({
      rows: [{ kind: "requested" as const, request: { ...f.request, tokenId: page ? "8" : "7" } }],
      head: 111,
      anchor: { number: 111, hash: "0xa" },
      rewind: page === null,
      next: page === null ? "canonical-page2" : null,
      // A rewind rescans from the ledger's deployment block.
      fromBlock: page === null ? DEPLOYED : from!,
    }),
  );
  await Effect.runPromise(
    finishRequestedChests(f.ports, new DurableChestStore(storage as unknown as DurableObjectStorage)),
  );
  expect(data.has("chests:request:orphan")).toBe(false);
  expect(data.get("chests:cursor")).toEqual({
    fromBlock: DEPLOYED,
    page: "canonical-page2",
    anchor: { number: 111, hash: "0xa" },
  });
  await Effect.runPromise(
    finishRequestedChests(f.ports, new DurableChestStore(storage as unknown as DurableObjectStorage)),
  );
  expect(f.ports.finish).toHaveBeenNthCalledWith(1, "7");
  expect(f.ports.finish).toHaveBeenNthCalledWith(2, "8");
  expect(f.ports.finish).toHaveBeenCalledTimes(2);
  expect(data.get("chests:cursor")).toEqual({ fromBlock: 112, page: null, anchor: { number: 111, hash: "0xa" } });
});

it("finishes a player's chest the moment its draw is readable, and only then", async () => {
  const f = fixture();
  f.ports.head = () => Effect.succeed(105);
  expect(await Effect.runPromise(finishChestNow(f.ports, "7"))).toEqual({ status: "drawing", blocksLeft: 6 });
  expect(f.ports.finish).not.toHaveBeenCalled();
  f.ports.head = () => Effect.succeed(111);
  expect(await Effect.runPromise(finishChestNow(f.ports, "7"))).toEqual({ status: "finished" });
  expect(f.ports.finish).toHaveBeenCalledExactlyOnceWith("7");
  f.ports.chest = () => Effect.succeed({ requested: true, finished: true, requester: "0x123", requestBlock: 100 });
  expect(await Effect.runPromise(finishChestNow(f.ports, "7"))).toEqual({ status: "finished" });
  expect(f.ports.finish).toHaveBeenCalledOnce();
  f.ports.chest = () => Effect.succeed({ requested: false, finished: false, requester: "0x0", requestBlock: 0 });
  expect(await Effect.runPromise(finishChestNow(f.ports, "8"))).toEqual({ status: "not_requested" });
  expect(f.ports.finish).toHaveBeenCalledOnce();
});
