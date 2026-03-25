import { describe, expect, it } from "vitest";

import { summarizeTransactionCalls } from "./transaction-event-summaries";

describe("summarizeTransactionCalls", () => {
  it("builds a readable summary for explorer movement calls", () => {
    const summaries = summarizeTransactionCalls([
      {
        contractAddress: "0xmove",
        entrypoint: "explorer_move",
        calldata: [191, [0, 5], 0],
      },
    ]);

    expect(summaries).toEqual([
      {
        contractAddress: "0xmove",
        entrypoint: "explorer_move",
        calldataSummary: "explorer_id=191, directions=[0,5], explore=0",
      },
    ]);
  });

  it("falls back to positional argument summaries for unknown entrypoints", () => {
    const summaries = summarizeTransactionCalls([
      {
        contractAddress: "0xabc",
        entrypoint: "do_custom_thing",
        calldata: [12, ["north", "east"], { nested: true }],
      },
    ]);

    expect(summaries[0]?.calldataSummary).toBe('arg0=12, arg1=["north","east"], arg2={"nested":true}');
  });
});
