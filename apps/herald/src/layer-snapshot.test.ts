import { getGameSyncModel } from "@bibliothecadao/eternum/game-sync-models";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createModelRegistry, readWorldManifest } from "./model-registry";
import { WorldFold } from "./world-fold";

const position = { blockNumber: 12, transactionHash: "0x1", transactionIndex: 0, eventIndex: 0 };

describe("layer snapshot identity", () => {
  it("streams both spire tiles before structures, including after checkpoint recovery", async () => {
    const manifest = await readWorldManifest(
      resolve(import.meta.dirname, "../../../contracts/l3/game/manifest_madara.json"),
    );
    const registry = createModelRegistry(manifest);
    const fold = new WorldFold(registry);
    for (const [index, alt] of [false, true].entries()) {
      fold.apply({
        kind: "set",
        model: getGameSyncModel("TileOpt"),
        entityId: `0x${index + 1}`,
        position,
        key: { game_id: 7n, alt, col: 10n, row: 20n },
        value: { data: (BigInt(alt) << 127n) | (10n << 81n) | (20n << 49n) | (3n << 41n) | (9n << 9n) | (35n << 1n) },
      });
    }
    const snapshot = fold.snapshot(7, 12, ["Structure", "TileOpt"]);
    expect(snapshot.models.map(({ model }) => model)).toEqual(["TileOpt", "Structure"]);
    expect(snapshot.models[0].rows.map(({ value }) => [value.alt, value.col, value.row])).toEqual([
      [false, "0xa", "0x14"],
      [true, "0xa", "0x14"],
    ]);
    expect(WorldFold.restore(registry, fold.checkpoint()).snapshot(7, 12, ["Structure", "TileOpt"])).toEqual(snapshot);
    expect(fold.snapshot(8, 12, ["TileOpt"]).models[0].rows).toEqual([]);
  });
});
