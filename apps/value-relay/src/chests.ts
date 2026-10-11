import { Effect, Result } from "effect";
import { RelayFailure, relayOperation, type ChestPage, type ChestPorts, type ChestRequest } from "./ports";

interface ChestCursor {
  fromBlock: number;
  page?: string | null;
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
        page: page.next,
      });
    });
  }
  async pending() {
    const after = await this.storage.get<string>("chests:queue-cursor");
    let page = await this.storage.list<ChestRequest>({
      prefix: "chests:request:",
      limit: 25,
      ...(after ? { startAfter: after } : {}),
    });
    if (!page.size && after) page = await this.storage.list<ChestRequest>({ prefix: "chests:request:", limit: 25 });
    await this.storage.put("chests:queue-cursor", page.size === 25 ? [...page.keys()].at(-1)! : "");
    return [...page.values()];
  }
  async complete(tokenId: string) {
    await this.storage.delete(`chests:request:${tokenId}`);
  }
}

/** The queue and event cursor commit together; requested tokens never disappear on a restart or failed finish. */
const observeRequests = (ports: Omit<ChestPorts, "finish">, store: ChestStore) =>
  Effect.gen(function* () {
    const cursor = yield* relayOperation("read chest cursor", () => store.cursor());
    const page = yield* ports.changes(cursor.fromBlock, cursor.page ?? null);
    if (page.head < cursor.fromBlock - 1 || page.rows.length > 100 || (page.next !== null && page.next === cursor.page))
      return yield* Effect.fail(new RelayFailure({ operation: "invalid_chest_event_page" }));
    yield* relayOperation("persist chest requests", () => store.observe(page));
  });

/** No new draw or expiry: finish the immutable request as soon as its fixed future block is readable. */
export const finishRequestedChests = (ports: ChestPorts, store: ChestStore) =>
  Effect.gen(function* () {
    yield* observeRequests(ports, store);
    const head = yield* ports.head();
    const pending = yield* relayOperation("read pending chests", () => store.pending());
    let finished = 0;
    let failed = 0;
    let outstanding = 0;
    for (const request of pending) {
      const attempt = yield* Effect.result(finishReadyChest(ports, store, request, head));
      if (Result.isSuccess(attempt)) {
        finished += attempt.success.finished;
        outstanding += attempt.success.pending;
      } else {
        failed++;
        outstanding++;
        yield* Effect.logError("chest_finish_failed", {
          tokenId: request.tokenId,
          operation: attempt.failure.operation,
        });
      }
    }
    return {
      finished,
      failed,
      pending: outstanding,
      checked: pending.length,
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
    if (!chest.finished && head < request.requestBlock + 11) return { finished: 0, pending: 1 };
    if (!chest.finished) yield* ports.finish(request.tokenId);
    yield* relayOperation("complete chest request", () => store.complete(request.tokenId));
    return { finished: chest.finished ? 0 : 1, pending: 0 };
  });
