import { describe, expect, it } from "vitest";
import { assertChainEventShape } from "./rpc";

describe("operator RPC event ingestion", () => {
  it("accepts the RPC v0.10 event position fields", () => {
    expect(
      assertChainEventShape({
        block_number: 10,
        transaction_hash: "0x123",
        transaction_index: 2,
        event_index: 3,
        from_address: "0x456",
        keys: ["0x1"],
        data: ["0x2"],
      }),
    ).toMatchObject({ transaction_index: 2, event_index: 3 });
  });

  it("rejects an older RPC event before sorting or deduplication", () => {
    expect(() =>
      assertChainEventShape({
        block_number: 10,
        transaction_hash: "0x123",
        from_address: "0x456",
        keys: ["0x1"],
        data: ["0x2"],
      }),
    ).toThrow("RPC v0.10 event shape");
  });
});
