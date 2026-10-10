import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { finishRequestedChests, overdueChestRequests } from "./chests";
import { RelayFailure, type ChestPorts, type ChestPage, type ChestRequest } from "./ports";

const fixture = () => {
  let cursor = { fromBlock: 0 };
  const requests = new Map<string, ChestRequest>();
  const request = { tokenId: "7", requester: "0x123", requestBlock: 100 };
  const store = {
    cursor: async () => cursor,
    observe: async (page: ChestPage) => {
      for (const row of page.rows) {
        if (row.kind === "requested") requests.set(row.request.tokenId, row.request);
        else requests.delete(row.tokenId);
      }
      cursor = { fromBlock: page.next === null ? page.head + 1 : cursor.fromBlock };
    },
    pending: async () => [...requests.values()],
    complete: async (id: string) => {
      requests.delete(id);
    },
  };
  const ports: ChestPorts = {
    changes: (from) =>
      Effect.succeed({ rows: from === 0 ? [{ kind: "requested", request }] : [], head: 110, next: null }),
    head: () => Effect.succeed(110),
    chest: () => Effect.succeed({ requested: true, finished: false, requester: "0x123", requestBlock: 100 }),
    blockTime: () => Effect.succeed(699),
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
      next: null,
    });
  await Effect.runPromise(finishRequestedChests(f.ports, f.store));
  expect(f.ports.finish).not.toHaveBeenCalled();
});
it("reports only requests overdue after five minutes of eligibility", async () => {
  const f = fixture();
  expect((await Effect.runPromise(overdueChestRequests(f.ports, f.store, 1000))).overdue).toEqual([]);
  f.ports.head = () => Effect.succeed(111);
  expect((await Effect.runPromise(overdueChestRequests(f.ports, f.store, 1000))).overdue).toEqual(["7"]);
  f.ports.blockTime = () => Effect.succeed(700);
  expect((await Effect.runPromise(overdueChestRequests(f.ports, f.store, 1000))).overdue).toEqual([]);
});
