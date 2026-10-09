import { describe, expect, it } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldFold } from "../world-fold";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import { manifest, schema, pointsAward, receipt } from "./fixtures";

describe("native replay provenance", () => {
  it.each(["model", "event", "nested type"])("refuses a changed %s under an unchanged schema commitment", (kind) => {
    const changed = structuredClone(manifest);
    const provenance = changed.native.schemas[schema.identity]!;
    if (kind === "model")
      provenance.models.find((row) => row.name === "PlayerPoints")!.members[0]!.type = "core::integer::u64";
    if (kind === "event")
      provenance.games.events.find((row) => row.name === "PointsAwarded")!.members[0]!.kind = "data";
    if (kind === "nested type") {
      const battle = provenance.types["world_native::rules::BattleConfig"]!;
      if (battle.type !== "struct") throw new Error("Expected BattleConfig struct");
      battle.members.push({ name: "extra_field", type: "core::integer::u32" });
    }
    expect(() => new NativeDecoder(changed)).toThrow("Native schema identity mismatch");
  });

  it("rebuilds the same points in the overlay, replay, checkpoint and client snapshot", async () => {
    const decoder = new NativeDecoder(manifest);
    const ingestion = new NativeIngestion(decoder);
    const fold = new WorldFold(decoder.registry);
    const observed = receipt([pointsAward("1", "0x111", "100", "100", "100")]);
    const overlay = fold.overlay();
    ingestion.applyReceipt(overlay, observed, null, 0);
    ingestion.applyReceipt(fold, observed, 10, 0);
    const replay = new WorldFold(decoder.registry);
    await ingestion.replay({
      fold: replay,
      fromBlock: 10,
      toBlock: 10,
      rpc: {
        getBlockWithReceipts: async () => ({
          block_number: 10,
          timestamp: 1800,
          transactions: [{ receipt: observed, transaction: { type: "INVOKE" } }],
        }),
      },
    });
    expect(replay.checkpoint()).toEqual(fold.checkpoint());
    expect(overlay.checkpoint()).toEqual(fold.checkpoint());
    const restored = WorldFold.restore(decoder.registry, replay.checkpoint());
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 1800 });
    for (const model of ["PlayerPoints", "PointsTotal"] as const)
      store.applyFacts(restored.modelRows(model).map(({ key, value }) => ({ model, key, value })));
    expect(store.require("PlayerPoints", { game_id: 1, address: 273n }).points).toBe(100n);
    expect(store.require("PointsTotal", { game_id: 1 }).total).toBe(100n);
  });
});
