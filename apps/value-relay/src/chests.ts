import { listStoredValues } from "./state";
import { Effect, Result } from "effect";
import { RelayFailure, relayOperation, type ChestPage, type ChestPorts, type ChestRequest } from "./ports";

interface ChestCursor {
  fromBlock: number;
}
interface ChestStore {
  cursor(): Promise<ChestCursor>;
  observe(page: ChestPage): Promise<void>;
  pending(): Promise<readonly ChestRequest[]>;
  complete(tokenId: string): Promise<void>;
}
export class DurableChestStore implements ChestStore {
  constructor(private readonly storage: DurableObjectStorage) {}
  async cursor(): Promise<ChestCursor> {
    return (await this.storage.get<ChestCursor>("chests:cursor")) ?? { fromBlock: 0 };
  }
  async observe(page: ChestPage): Promise<void> {
    const cursor = await this.cursor();
    await this.storage.transaction(async (tx) => {
      for (const change of page.rows) {
        if (change.kind === "requested") await tx.put(`chests:request:${change.request.tokenId}`, change.request);
        else await tx.delete(`chests:request:${change.tokenId}`);
      }
      await tx.put("chests:cursor", {
        fromBlock: page.next === null ? page.head + 1 : cursor.fromBlock,
      });
    });
  }
  async pending() {
    return listStoredValues<ChestRequest>(this.storage, "chests:request:");
  }
  async complete(tokenId: string) {
    await this.storage.delete(`chests:request:${tokenId}`);
  }
}

/** The queue and event cursor commit together; requested tokens never disappear on a restart or failed finish. */
const observeRequests = (ports: Omit<ChestPorts, "finish">, store: ChestStore) =>
  Effect.gen(function* () {
    const seen = new Set<string>();
    const cursor = yield* relayOperation("read chest cursor", () => store.cursor());
    let continuation: string | null = null;
    do {
      const page: ChestPage = yield* ports.changes(cursor.fromBlock, continuation);
      if (page.head < cursor.fromBlock - 1)
        return yield* Effect.fail(new RelayFailure({ operation: "chest_head_regressed" }));
      if (page.next !== null && seen.has(page.next))
        return yield* Effect.fail(new RelayFailure({ operation: "chest_page_cycle" }));
      if (page.next !== null) seen.add(page.next);
      yield* relayOperation("persist chest requests", () => store.observe(page));
      continuation = page.next;
    } while (continuation !== null);
  });

/** No new draw or expiry: finish the immutable request as soon as its fixed future block is readable. */
export const finishRequestedChests = (ports: ChestPorts, store: ChestStore) =>
  Effect.gen(function* () {
    yield* observeRequests(ports, store);
    const head = yield* ports.head();
    const pending = yield* relayOperation("read pending chests", () => store.pending());
    let finished = 0;
    let failed = 0;
    for (const request of pending) {
      const attempt = yield* Effect.result(finishReadyChest(ports, store, request, head));
      if (Result.isSuccess(attempt)) finished += attempt.success;
      else {
        failed++;
        yield* Effect.logError("chest_finish_failed", {
          tokenId: request.tokenId,
          operation: attempt.failure.operation,
        });
      }
    }
    return {
      finished,
      failed,
      pending: (yield* relayOperation("read remaining chests", () => store.pending())).length,
    };
  });
const finishReadyChest = (ports: ChestPorts, store: ChestStore, request: ChestRequest, head: number) =>
  Effect.gen(function* () {
    const chest = yield* ports.chest(request.tokenId);
    if (
      !chest.requested ||
      chest.requestBlock !== request.requestBlock ||
      BigInt(chest.requester) !== BigInt(request.requester)
    )
      return yield* Effect.fail(new RelayFailure({ operation: "chest_request_differs" }));
    if (!chest.finished && head < request.requestBlock + 11) return 0;
    if (!chest.finished) yield* ports.finish(request.tokenId);
    yield* relayOperation("complete chest request", () => store.complete(request.tokenId));
    return chest.finished ? 0 : 1;
  });

/** Warn after five minutes of eligibility; immature requests do not create an overdue alarm. */
export const overdueChestRequests = (
  ports: Omit<ChestPorts, "finish">,
  store: ChestStore,
  now = Math.floor(Date.now() / 1000),
) =>
  Effect.gen(function* () {
    yield* observeRequests(ports, store);
    const head = yield* ports.head();
    const pending = yield* relayOperation("read pending chests", () => store.pending());
    const overdue: string[] = [];
    for (const request of pending) {
      const chest = yield* ports.chest(request.tokenId);
      if (chest.finished) {
        yield* relayOperation("complete observed chest", () => store.complete(request.tokenId));
        continue;
      }
      if (head < request.requestBlock + 11) continue;
      const eligibleAt = yield* ports.blockTime(request.requestBlock + 11);
      if (now - eligibleAt > 300) overdue.push(request.tokenId);
    }
    return { overdue, pending: (yield* relayOperation("read remaining chests", () => store.pending())).length };
  });
