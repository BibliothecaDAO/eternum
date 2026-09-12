import { getGameSyncModel } from "@bibliothecadao/eternum/game-sync-models";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createModelRegistry, readWorldManifest } from "./model-registry";
import { WorldFold } from "./world-fold";

describe("mine labor sync", () => {
  it("retains both labor models in snapshots and checkpoint recovery", async () => {
    const manifest = await readWorldManifest(
      resolve(import.meta.dirname, "../../../contracts/l3/game/manifest_madara.json"),
    );
    const registry = createModelRegistry(manifest);
    const fold = new WorldFold(registry);
    const position = { blockNumber: 12, transactionHash: "0x1", transactionIndex: 0, eventIndex: 0 };
    fold.apply({
      kind: "set",
      model: getGameSyncModel("BitcoinMinePhaseLabor"),
      entityId: "0x1",
      position,
      key: { game_id: 7n, phase_id: 2n, mine_id: 9n },
      value: { labor_contributed: 100n, claimed: false },
    });
    fold.apply({
      kind: "set",
      model: getGameSyncModel("BitcoinPhaseLabor"),
      entityId: "0x2",
      position,
      key: { game_id: 7n, phase_id: 2n },
      value: { total_labor: 100n, prize_pool: 10n, participant_count: 1n, claim_count: 0n, reward_receiver_phase: 0n },
    });
    const models = ["BitcoinMinePhaseLabor", "BitcoinPhaseLabor"];
    const snapshot = fold.snapshot(7, 12, models);
    expect(snapshot.models.map(({ rows }) => rows.length)).toEqual([1, 1]);
    expect(snapshot.models[0].rows[0].value).toMatchObject({
      mine_id: "0x9",
      labor_contributed: "0x64",
      claimed: false,
    });
    expect(WorldFold.restore(registry, fold.checkpoint()).snapshot(7, 12, models)).toEqual(snapshot);
    expect(fold.snapshot(8, 12, models).models.every(({ rows }) => rows.length === 0)).toBe(true);
  });
});
