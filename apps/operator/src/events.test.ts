import { describe, expect, it } from "vitest";
import {
  EVENT_EMITTED_SELECTOR,
  REGISTERED_SELECTOR,
  parseLedgerRegistration,
  parseLedgerResults,
  resultCommitment,
} from "./events";
import type { ChainEvent } from "./types";

const ROW = "0x111";
const READY = "0x222";

describe("operator event decoding", () => {
  it("decodes the mainnet registration entitlement", () => {
    const message = parseLedgerRegistration(
      event({
        keys: [REGISTERED_SELECTOR, "0x7", "0xabc"],
        data: ["0x2", "0x1", "0x3", "0x4", "0x5"],
      }),
    );

    expect(message).toEqual({
      gameId: 7,
      owner: "0xabc",
      realmId: (1n << 128n) + 2n,
      metadata: ["0x3", "0x4", "0x5"],
    });
  });

  it("assembles one ordered result after its ready marker", () => {
    const messages = parseLedgerResults(
      [
        dojoEvent(ROW, ["0x7", "0x9", "0x1"], ["0xbbb", "0x1", "0x2"], 1),
        dojoEvent(ROW, ["0x7", "0x9", "0x0"], ["0xaaa", "0x1", "0x3"], 0),
        dojoEvent(READY, ["0x7", "0x9"], ["0x2"], 2),
      ],
      { resultRowSelector: ROW, resultReadySelector: READY },
    );

    expect(messages).toEqual([
      {
        gameId: 7,
        trialId: 9n,
        rows: [
          { owner: "0xaaa", rank: 1, chests: 3 },
          { owner: "0xbbb", rank: 1, chests: 2 },
        ],
      },
    ]);
  });

  it("rejects a ready marker with a missing row", () => {
    expect(() =>
      parseLedgerResults(
        [
          dojoEvent(ROW, ["0x7", "0x9", "0x1"], ["0xbbb", "0x2", "0x2"], 0),
          dojoEvent(READY, ["0x7", "0x9"], ["0x2"], 1),
        ],
        { resultRowSelector: ROW, resultReadySelector: READY },
      ),
    ).toThrow("declared 2 rows but received 1");
  });

  it("matches the ledger result commitment", () => {
    expect(
      resultCommitment({
        gameId: 7,
        trialId: 9n,
        rows: [
          { owner: "0x3e8", rank: 1, chests: 3 },
          { owner: "0x3e9", rank: 1, chests: 2 },
        ],
      }),
    ).toBe("0x3c7fe8cc71208719a97530868d02e7dc226bb064a5a01abcc48d964be511342");
  });
});

function dojoEvent(selector: string, keys: string[], values: string[], eventIndex: number): ChainEvent {
  return event({
    keys: [EVENT_EMITTED_SELECTOR, selector, "0xdead"],
    data: [keys.length.toString(), ...keys, values.length.toString(), ...values],
    event_index: eventIndex,
  });
}

function event(overrides: Partial<ChainEvent>): ChainEvent {
  return {
    block_number: 10,
    transaction_hash: "0x123",
    transaction_index: 0,
    event_index: 0,
    from_address: "0x456",
    keys: [],
    data: [],
    ...overrides,
  };
}
