import { describe, expect, it, vi } from "vitest";
import { completeBlitzResults, type ResultOperations } from "./results";

function fixture(count = 13) {
  const players = Array.from({ length: count }, (_, index) => ({
    player: BigInt(index + 1),
    points: index < 2 ? 9_000_000n : 0n,
  }));
  const recorded: { player: bigint; points: bigint; rank: number }[] = [];
  const operations: ResultOperations = {
    secondsUntilEnd: vi.fn(async () => 0),
    settle: vi.fn(async () => undefined),
    progress: vi.fn(async () => ({
      players: [...recorded],
      complete: recorded.length === count,
      commitment: recorded.length === count ? 123n : 0n,
    })),
    players: vi.fn(async () => players.toReversed()),
    record: vi.fn(async (start, batch) => {
      expect(start).toBe(recorded.length);
      recorded.push(...(batch as typeof recorded));
    }),
  };
  return { operations, recorded };
}

describe("native result jobs", () => {
  it("settles points first and batches a complete roster with competition ties", async () => {
    const { operations, recorded } = fixture();
    await expect(completeBlitzResults(operations)).resolves.toBe(123n);
    expect(operations.settle).toHaveBeenCalledOnce();
    expect(vi.mocked(operations.record).mock.calls.map((call) => call[1].length)).toEqual([8, 5]);
    expect(recorded.map(({ player, rank }) => [player, rank])).toEqual(
      Array.from({ length: 13 }, (_, i) => [BigInt(i + 1), i < 2 ? 1 : 3]),
    );
    expect(vi.mocked(operations.settle).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(operations.players).mock.invocationCallOrder[0],
    );
  });
  it("resumes after a receipt is lost without recording the landed batch again", async () => {
    const { operations, recorded } = fixture();
    const record = operations.record;
    operations.record = vi.fn(async (start, players) => {
      await record(start, players);
      if (start === 0) throw new Error("connection lost after inclusion");
    });
    await expect(completeBlitzResults(operations)).rejects.toThrow("connection lost");
    expect(recorded).toHaveLength(8);
    await expect(completeBlitzResults(operations)).resolves.toBe(123n);
    expect(vi.mocked(operations.record).mock.calls.map(([start]) => start)).toEqual([0, 8]);
    expect(new Set(recorded.map(({ player }) => player)).size).toBe(13);
  });
  it("adopts a complete chain result after restart without submitting again", async () => {
    const { operations } = fixture(1);
    await completeBlitzResults(operations);
    vi.mocked(operations.record).mockClear();
    vi.mocked(operations.players).mockClear();
    await expect(completeBlitzResults(operations)).resolves.toBe(123n);
    expect(operations.record).not.toHaveBeenCalled();
    expect(operations.players).not.toHaveBeenCalled();
  });
  it("retries point settlement before constructing any results", async () => {
    const { operations } = fixture();
    vi.mocked(operations.settle).mockRejectedValueOnce(new Error("checkpoint interrupted"));
    await expect(completeBlitzResults(operations)).rejects.toThrow("checkpoint interrupted");
    expect(operations.record).not.toHaveBeenCalled();
    await expect(completeBlitzResults(operations)).resolves.toBe(123n);
  });
  it("refuses to settle before the chain reaches the game's end", async () => {
    const { operations } = fixture();
    vi.mocked(operations.secondsUntilEnd).mockResolvedValueOnce(90);
    await expect(completeBlitzResults(operations)).rejects.toMatchObject({ secondsUntilEnd: 90 });
    expect(operations.settle).not.toHaveBeenCalled();
    await expect(completeBlitzResults(operations)).resolves.toBe(123n);
  });
  it("fails loudly if the authoritative cursor does not advance", async () => {
    const { operations } = fixture();
    operations.record = vi.fn(async () => undefined);
    await expect(completeBlitzResults(operations)).rejects.toThrow("no progress");
  });
});
