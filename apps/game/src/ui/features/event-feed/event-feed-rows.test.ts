import type { Transaction } from "@/hooks/store/use-transaction-store";
import { TransactionType } from "@bibliothecadao/provider";
import { type ResourceArrivalInfo, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { deriveFeedRows, selectTickerRows } from "./event-feed-rows";

const NOW_MS = 1_700_000_000_000;
const NOW_SECONDS = NOW_MS / 1000;

const transfer = (overrides: Partial<Transaction> = {}): Transaction => ({
  hash: "0xsend",
  type: TransactionType.SEND,
  status: "pending",
  submittedAt: NOW_MS - 500,
  description: "Sent resources",
  ...overrides,
});

const caravan = (arrivesInSeconds: number): ResourceArrivalInfo => ({
  structureEntityId: 42,
  resources: [{ resourceId: ResourcesIds.Wood, amount: 100 }],
  arrivesAt: BigInt(Math.floor(NOW_SECONDS + arrivesInSeconds)),
  day: 3n,
  slot: 1n,
});

const derive = (input: Partial<Parameters<typeof deriveFeedRows>[0]> = {}) =>
  deriveFeedRows({
    transactions: [],
    arrivals: [],
    notices: [],
    nowMs: NOW_MS,
    nowSeconds: NOW_SECONDS,
    stuckThresholdMs: 30_000,
    ...input,
  });

describe("deriveFeedRows", () => {
  it("a started transfer is an in-flight row from its pending transaction", () => {
    const rows = derive({ transactions: [transfer()] });
    expect(rows.inFlight).toMatchObject([{ kind: "transaction", id: "0xsend", isStuck: false }]);
    expect(rows.recent).toEqual([]);
  });

  it("its caravan is an in-flight row with a countdown, and flips to arrived when its time passes", () => {
    const enRoute = derive({ arrivals: [caravan(90)] });
    expect(enRoute.inFlight).toMatchObject([{ kind: "arrival", structureEntityId: 42, remainingSeconds: 90 }]);
    expect(enRoute.arrived).toEqual([]);

    const landed = derive({ arrivals: [caravan(-5)] });
    expect(landed.inFlight).toEqual([]);
    expect(landed.arrived).toMatchObject([{ kind: "arrival", structureEntityId: 42, remainingSeconds: 0 }]);
  });

  it("a confirmed transaction moves to recent at its confirmation time, stuck ones lead the in-flight list", () => {
    const rows = derive({
      transactions: [
        transfer({ hash: "0xdone", status: "success", submittedAt: NOW_MS - 9_000, confirmedAt: NOW_MS - 1_000 }),
        transfer({ hash: "0xfresh", submittedAt: NOW_MS - 100 }),
        transfer({ hash: "0xstuck", submittedAt: NOW_MS - 60_000 }),
      ],
    });
    expect(rows.inFlight.map((row) => row.id)).toEqual(["0xstuck", "0xfresh"]);
    expect(rows.recent).toMatchObject([{ id: "0xdone", at: NOW_MS - 1_000 }]);
  });

  it("notices join the recent list by time and the ticker keeps them for their own ttl", () => {
    const rows = derive({
      transactions: [transfer({ hash: "0xold", status: "success", confirmedAt: NOW_MS - 20_000 })],
      notices: [
        { id: "n1", kind: "info", title: "Guild added", at: NOW_MS - 2_000, ttlMs: 6_000 },
        { id: "n2", kind: "error", title: "Failed", at: NOW_MS - 10_000, ttlMs: 6_000 },
      ],
    });
    expect(rows.recent.map((row) => row.id)).toEqual(["n1", "n2", "0xold"]);
    expect(selectTickerRows(rows, NOW_MS, 6_000).map((row) => row.id)).toEqual(["n1"]);
  });
});
