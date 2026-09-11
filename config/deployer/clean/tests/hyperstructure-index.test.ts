import { describe, expect, it } from "vitest";
import { planHyperstructureIndexBackfill } from "../indexing/hyperstructure-index";

function snapshot(count: number, completed: number[], indexed: Array<[number, number]> = []) {
  const model = (name: string, values: Record<string, unknown>[]) => ({
    model: `s2-${name}`,
    rows: values.map((value) => ({ key: "", value: { game_id: 1, ...value } })),
  });
  return {
    game_id: "1",
    confirmed_block: 99,
    models: [
      model("HyperstructureGlobals", [{ completed_count: count }]),
      model(
        "Hyperstructure",
        completed.map((hyperstructure_id) => ({ hyperstructure_id, initialized: true, completed: true })),
      ),
      model(
        "CompletedHyperstructure",
        indexed.map(([index, hyperstructure_id]) => ({ index, hyperstructure_id })),
      ),
    ],
  };
}

describe("completion index migration", () => {
  it("fills missing entries while preserving previously assigned slots", () => {
    expect(planHyperstructureIndexBackfill(snapshot(3, [18, 7, 12], [[1, 18]]))).toEqual([7, 18, 12]);
  });
  it("can repeat a completed migration", () => {
    expect(
      planHyperstructureIndexBackfill(
        snapshot(
          3,
          [18, 7, 12],
          [
            [0, 7],
            [1, 18],
            [2, 12],
          ],
        ),
      ),
    ).toEqual([7, 18, 12]);
  });
  it("rejects an incomplete snapshot instead of skipping completed structures", () => {
    expect(() => planHyperstructureIndexBackfill(snapshot(3, [7, 12]))).toThrow("game counter");
  });
  it("rejects duplicate assignments and unknown IDs", () => {
    expect(() =>
      planHyperstructureIndexBackfill(
        snapshot(
          2,
          [7, 12],
          [
            [0, 7],
            [1, 7],
          ],
        ),
      ),
    ).toThrow("inconsistent");
    expect(() => planHyperstructureIndexBackfill(snapshot(2, [7, 12], [[0, 99]]))).toThrow("inconsistent");
  });
  it("rejects cross-game input", () => {
    const input = snapshot(1, [7]);
    input.game_id = "2";
    expect(() => planHyperstructureIndexBackfill(input)).toThrow("different game");
  });
  it("handles a game with no completed structures", () => {
    expect(planHyperstructureIndexBackfill(snapshot(0, []))).toEqual([]);
  });
  it("rejects a snapshot that omits the requested model", () => {
    const input = snapshot(0, []);
    input.models = [];
    expect(() => planHyperstructureIndexBackfill(input)).toThrow("Expected one");
  });
});
