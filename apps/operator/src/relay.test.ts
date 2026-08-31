import { describe, expect, it, vi } from "vitest";
import { EVENT_EMITTED_SELECTOR, REGISTERED_SELECTOR } from "./events";
import { PoisonedRelayMessageError } from "./relay-errors";
import { OperatorRelay, runRelayLoop } from "./relay";
import type { ChainEvent, CursorStore, EventSource, LedgerResultsMessage } from "./types";

const ROW = "0x111";
const READY = "0x222";

describe("operator relay cursors", () => {
  it("advances the registration cursor only after the L3 write", async () => {
    const cursor = memoryCursor();
    const write = vi.fn(async () => "0xl3");
    const relay = buildRelay({
      cursor,
      ledgerEvents: [event({ keys: [REGISTERED_SELECTOR, "0x7", "0xabc"], data: ["0", "0", "0", "0", "0"] })],
      registrationWrite: write,
    });

    expect(await relay.relayRegistrationsOnce()).toEqual({ fromBlock: 5, toBlock: 7, messages: 1, skipped: 0 });
    expect(write).toHaveBeenCalledTimes(1);
    expect(cursor.values.get("mainnet-registrations")).toBe(8);
  });

  it("does not advance the cursor when a write fails", async () => {
    const cursor = memoryCursor();
    const relay = buildRelay({
      cursor,
      ledgerEvents: [event({ keys: [REGISTERED_SELECTOR, "0x7", "0xabc"], data: ["0", "0", "0", "0", "0"] })],
      registrationWrite: vi.fn(async () => {
        throw new Error("write failed");
      }),
    });

    await expect(relay.relayRegistrationsOnce()).rejects.toThrow("write failed");
    expect(cursor.values.get("mainnet-registrations")).toBe(5);
  });

  it("skips a result already finalized before a restarted cursor advances", async () => {
    const cursor = memoryCursor();
    const write = vi.fn(async (_message: LedgerResultsMessage) => "0xmainnet");
    const relay = buildRelay({
      cursor,
      resultEvents: [
        dojoEvent(ROW, ["0x7", "0x9", "0"], ["0xabc", "1", "2"], 0),
        dojoEvent(READY, ["0x7", "0x9"], ["1"], 1),
      ],
      resultFinalized: true,
      resultWrite: write,
    });

    expect(await relay.relayResultsOnce()).toEqual({ fromBlock: 6, toBlock: 9, messages: 1, skipped: 1 });
    expect(write).not.toHaveBeenCalled();
    expect(cursor.values.get("s2-results")).toBe(10);
  });

  it("takes one advisory lock for each relay stream", async () => {
    const cursor = memoryCursor();
    const relay = buildRelay({ cursor });

    await relay.acquireStreamLocks();

    expect(cursor.acquire).toHaveBeenCalledWith("mainnet-registrations");
    expect(cursor.acquire).toHaveBeenCalledWith("s2-results");
  });

  it("emits a distinct poison-halt alert for a permanent message rejection", async () => {
    const abort = new AbortController();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runRelayLoop({
      abort: abort.signal,
      label: "s2-results",
      pollMs: 1,
      run: async () => {
        abort.abort();
        throw new PoisonedRelayMessageError("results", 7, "Ledger: unregistered result owner");
      },
    });

    expect(error).toHaveBeenCalledWith(expect.stringContaining('"event":"operator_poison_halt"'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"gameId":7'));
    error.mockRestore();
  });
});

function buildRelay(input: {
  cursor: ReturnType<typeof memoryCursor>;
  ledgerEvents?: ChainEvent[];
  registrationWrite?: (message: never) => Promise<string>;
  resultEvents?: ChainEvent[];
  resultFinalized?: boolean;
  resultWrite?: (message: LedgerResultsMessage) => Promise<string>;
}) {
  return new OperatorRelay({
    cursorStore: input.cursor,
    initialLedgerBlock: 5,
    initialS2Block: 6,
    ledgerConfirmationDepth: 2,
    ledgerAddress: "0xledger",
    ledgerSource: source(input.ledgerEvents ?? []),
    registrationWriter: { write: input.registrationWrite ?? vi.fn(async () => "0xl3") },
    resultReadySelector: READY,
    resultRowSelector: ROW,
    resultsWriter: {
      isFinalized: vi.fn(async () => input.resultFinalized ?? false),
      write: input.resultWrite ?? vi.fn(async () => "0xmainnet"),
    },
    s2Source: source(input.resultEvents ?? []),
    worldAddress: "0xworld",
  });
}

function source(events: ChainEvent[]): EventSource {
  return {
    blockNumber: vi.fn(async () => 9),
    getEvents: vi.fn(async () => events),
  };
}

function memoryCursor(): CursorStore & { values: Map<string, number> } {
  const values = new Map<string, number>();
  return {
    values,
    acquire: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    read: vi.fn(async (stream, initial) => {
      if (!values.has(stream)) values.set(stream, initial);
      return values.get(stream)!;
    }),
    advance: vi.fn(async (stream, nextBlock) => {
      values.set(stream, nextBlock);
    }),
  };
}

function dojoEvent(selector: string, keys: string[], values: string[], eventIndex: number): ChainEvent {
  return event({
    keys: [EVENT_EMITTED_SELECTOR, selector, "0xdead"],
    data: [keys.length.toString(), ...keys, values.length.toString(), ...values],
    event_index: eventIndex,
  });
}

function event(overrides: Partial<ChainEvent>): ChainEvent {
  return {
    block_number: 9,
    transaction_hash: "0x123",
    transaction_index: 0,
    event_index: 0,
    from_address: "0x456",
    keys: [],
    data: [],
    ...overrides,
  };
}
