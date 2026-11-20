import { describe, expect, it, vi } from "vitest";
import { completeBlitzResults, gameResult, type ResultOperations } from "./results";
function fixture() {
  let complete = false;
  const operations: ResultOperations = {
    secondsUntilEnd: vi.fn(async () => 0),
    settle: vi.fn(async () => undefined),
    progress: vi.fn(async () => ({
      players: complete ? [{ wallet: 1n, rank: 1 }] : [],
      complete,
      commitment: complete ? 123n : 0n,
    })),
    record: vi.fn(async () => {
      complete = true;
    }),
  };
  return { operations };
}
describe("native result jobs", () => {
  it("settles final points then requests the shard-derived result without ranks or a cursor", async () => {
    const { operations } = fixture();
    expect(await completeBlitzResults(operations)).toBe(123n);
    expect(operations.record).toHaveBeenCalledOnce();
    expect(operations.record).toHaveBeenCalledWith();
    expect(vi.mocked(operations.settle).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(operations.record).mock.invocationCallOrder[0]!,
    );
  });
  it("recovers a lost receipt from the complete result without a second command", async () => {
    const { operations } = fixture();
    const record = operations.record;
    operations.record = vi.fn(async () => {
      await record();
      throw new Error("connection lost after inclusion");
    });
    await expect(completeBlitzResults(operations)).rejects.toThrow("connection lost");
    expect(await completeBlitzResults(operations)).toBe(123n);
    expect(operations.record).toHaveBeenCalledOnce();
  });
  it("keeps a result retryable when point settlement fails", async () => {
    const { operations } = fixture();
    vi.mocked(operations.settle).mockRejectedValueOnce(new Error("checkpoint interrupted"));
    await expect(completeBlitzResults(operations)).rejects.toThrow("checkpoint interrupted");
    expect(operations.record).not.toHaveBeenCalled();
    expect(await completeBlitzResults(operations)).toBe(123n);
  });
  it("refuses before the chain reaches the end", async () => {
    const { operations } = fixture();
    vi.mocked(operations.secondsUntilEnd).mockResolvedValueOnce(90);
    await expect(completeBlitzResults(operations)).rejects.toMatchObject({ secondsUntilEnd: 90 });
    expect(operations.settle).not.toHaveBeenCalled();
  });
  it("refuses to acknowledge an incomplete result after the unit command", async () => {
    const { operations } = fixture();
    operations.record = vi.fn(async () => undefined);
    await expect(completeBlitzResults(operations)).rejects.toThrow("result_not_complete");
  });
});

describe("game result", () => {
  const shardAnswering = (span: bigint[]) => {
    const view = vi.fn(async () => span);
    return { shard: { view } as unknown as Parameters<typeof gameResult>[0], view };
  };
  it("reads the ranked wallets, completeness and commitment from the game's result span", async () => {
    const { shard, view } = shardAnswering([2n, 0x123n, 1n, 0x456n, 2n, 1n, 0xabcn]);
    expect(await gameResult(shard, 7)).toEqual({
      players: [
        { wallet: 0x123n, rank: 1 },
        { wallet: 0x456n, rank: 2 },
      ],
      complete: true,
      commitment: 0xabcn,
    });
    expect(view).toHaveBeenCalledWith("game_result", [7]);
  });
  it("reads an incomplete result as no players and no commitment", async () => {
    expect(await gameResult(shardAnswering([0n, 0n, 0n]).shard, 7)).toEqual({
      players: [],
      complete: false,
      commitment: 0n,
    });
  });
  it.each([[[]], [[2n, 0x123n, 1n, 1n, 0xabcn]], [[0n, 0n, 0n, 0n]]])(
    "refuses a span whose length does not match its count (case %#)",
    async (span) => {
      await expect(gameResult(shardAnswering(span).shard, 7)).rejects.toThrow("invalid_result_layout");
    },
  );
});
