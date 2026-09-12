import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckpointStore } from "./checkpoint-store";
import type { ModelRegistry } from "./model-registry";
import { WorldFold } from "./world-fold";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    query = query;
  },
}));

const registry: ModelRegistry = {
  worldAddress: "0x1",
  persistent: [],
  events: [],
  bySelector: new Map(),
};

afterEach(() => {
  vi.restoreAllMocks();
  query.mockReset();
});

describe("checkpoint model retirement", () => {
  it("discards a stored checkpoint with quest and biome rows so startup replays history", async () => {
    const checkpoint = new WorldFold(registry).checkpoint();
    for (const model of ["QuestLevels", "QuestTile", "BiomeDiscovered"]) {
      checkpoint.models.push({ model, rows: [{ entity_id: "0x77", key: {}, value: { stale: true } }] });
    }
    query.mockResolvedValue({ rows: [{ confirmed_block: "42", payload: gzipSync(JSON.stringify(checkpoint)) }] });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await new CheckpointStore("postgres://unused").load("madara", registry)).toBeUndefined();
    expect(JSON.parse(warning.mock.calls[0][0])).toMatchObject({
      event: "herald_checkpoint_discarded",
      confirmedBlock: 42,
      mismatch: "missing=none, unexpected=QuestLevels,QuestTile,BiomeDiscovered",
    });
    expect(() => WorldFold.restore(registry, checkpoint)).toThrow("Checkpoint model mismatch");
  });

  it("restores a checkpoint when its model set still matches", async () => {
    const checkpoint = new WorldFold(registry).checkpoint();
    query.mockResolvedValue({ rows: [{ confirmed_block: "42", payload: gzipSync(JSON.stringify(checkpoint)) }] });
    const restored = await new CheckpointStore("postgres://unused").load("madara", registry);
    expect(restored?.confirmedBlock).toBe(42);
    expect(restored?.fold.checkpoint()).toEqual(checkpoint);
  });
});
