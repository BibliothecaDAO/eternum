import type { Transaction } from "@/hooks/store/use-transaction-store";
import { TransactionType } from "@bibliothecadao/provider";
import { describe, expect, it } from "vitest";
import { deriveFeedRows, transactionStatusLine, transferRowLabel } from "./event-feed-rows";

const NOW_MS = 1_700_000_000_000;

const transfer = (overrides: Partial<Transaction> = {}): Transaction => ({
  hash: "0xsend",
  type: TransactionType.SEND,
  status: "pending",
  submittedAt: NOW_MS - 500,
  description: "Sent resources",
  ...overrides,
});

const derive = (input: Partial<Parameters<typeof deriveFeedRows>[0]> = {}) =>
  deriveFeedRows({ transactions: [], notices: [], ...input });

describe("deriveFeedRows", () => {
  it("a send the store holds twice under one hash is one row", () => {
    const rows = derive({ transactions: [transfer(), transfer({ submittedAt: NOW_MS - 400 })] });
    expect(rows.inFlight.map((row) => row.id)).toEqual(["0xsend"]);
  });

  it("a started transfer is an in-flight row from its pending transaction", () => {
    const rows = derive({ transactions: [transfer()] });
    expect(rows.inFlight).toMatchObject([{ kind: "transaction", id: "0xsend" }]);
    expect(rows.recent).toEqual([]);
  });

  it("a confirmed transaction moves to recent at its confirmation time, the in-flight list runs newest first", () => {
    const rows = derive({
      transactions: [
        transfer({ hash: "0xdone", status: "success", submittedAt: NOW_MS - 9_000, confirmedAt: NOW_MS - 1_000 }),
        transfer({ hash: "0xchecking", status: "checking", submittedAt: NOW_MS - 60_000 }),
        transfer({ hash: "0xfresh", submittedAt: NOW_MS - 100 }),
      ],
    });
    expect(rows.inFlight.map((row) => row.id)).toEqual(["0xfresh", "0xchecking"]);
    expect(rows.recent).toMatchObject([{ id: "0xdone", at: NOW_MS - 1_000 }]);
  });

  it("notices join the recent list by time", () => {
    const rows = derive({
      transactions: [transfer({ hash: "0xold", status: "success", confirmedAt: NOW_MS - 20_000 })],
      notices: [
        { id: "n1", kind: "info", title: "Guild added", at: NOW_MS - 2_000, ttlMs: 6_000 },
        { id: "n2", kind: "error", title: "Failed", at: NOW_MS - 10_000, ttlMs: 6_000 },
      ],
    });
    expect(rows.recent.map((row) => row.id)).toEqual(["n1", "n2", "0xold"]);
  });
});

it("names a done send a caravan sent, and nothing else", () => {
  expect(transferRowLabel(derive({ transactions: [transfer({ status: "success" })] }).recent[0])).toBe("Caravan sent");
  expect(transferRowLabel(derive({ transactions: [transfer({ status: "reverted" })] }).recent[0])).toBeNull();
});

describe("an action's one status line", () => {
  it("says sending, checking, done, refused with the reason, or not sent, and never asks to try again", () => {
    expect(transactionStatusLine(transfer())).toBe("Sending");
    expect(transactionStatusLine(transfer({ status: "checking" }))).toBe("Checking");
    expect(transactionStatusLine(transfer({ status: "success" }))).toBe("Done");
    expect(transactionStatusLine(transfer({ status: "reverted", errorMessage: "Not enough donkeys" }))).toBe(
      "Refused: Not enough donkeys",
    );
    expect(transactionStatusLine(transfer({ status: "not_sent" }))).toBe("Not sent");
  });

  it("says the client's own words when no answer came for the action, and lists it with what has ended", () => {
    const words = "No answer yet. This action may still apply. You can try another action.";
    const unanswered = transfer({ status: "no_answer", errorMessage: words });
    expect(transactionStatusLine(unanswered)).toBe(words);
    expect(transactionStatusLine(transfer({ status: "no_answer" }))).toBe("No answer yet");
    const rows = derive({ transactions: [unanswered] });
    expect(rows.inFlight).toEqual([]);
    expect(rows.recent).toHaveLength(1);
  });

  it("keeps a checking action in flight: its outcome is still being reconciled", () => {
    const checking = transfer({ status: "checking", submittedAt: NOW_MS - 60_000 });
    expect(derive({ transactions: [checking] }).inFlight).toEqual([
      { kind: "transaction", id: "0xsend", at: checking.submittedAt, transaction: checking },
    ]);
  });
});
