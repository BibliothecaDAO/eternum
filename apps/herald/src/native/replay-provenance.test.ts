import { describe, expect, it } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldFold } from "../world-fold";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import { manifest, schema, receipt, rowEvent } from "./fixtures";

describe("native replay provenance", () => {
  it.each(["model", "event", "nested type"])("refuses a changed %s under an unchanged schema commitment", (kind) => {
    const changed = structuredClone(manifest);
    const provenance = changed.native.schemas[schema.identity]!;
    if (kind === "model")
      provenance.models.find((row) => row.name === "Fragments")!.members[0]!.type = "core::integer::u64";
    if (kind === "event") provenance.games.events.find((row) => row.name === "BattleEvent")!.members[0]!.kind = "data";
    if (kind === "nested type") {
      const battle = provenance.types["world_native::rules::BattleConfig"]!;
      if (battle.type !== "struct") throw new Error("Expected BattleConfig struct");
      battle.members.push({ name: "extra_field", type: "core::integer::u32" });
    }
    expect(() => new NativeDecoder(changed)).toThrow("Native schema identity mismatch");
  });

  it("rebuilds the same row in the overlay, replay, checkpoint and client snapshot", async () => {
    const decoder = new NativeDecoder(manifest);
    const ingestion = new NativeIngestion(decoder);
    const fold = new WorldFold(decoder.registry);
    const observed = receipt([rowEvent("Fragments", ["1", "0x111"], { balance: 100n })]);
    const overlay = fold.overlay();
    ingestion.applyReceipt(overlay, observed, null, 0);
    ingestion.applyReceipt(fold, observed, 10, 0);
    const replay = new WorldFold(decoder.registry);
    await ingestion.replay({
      fold: replay,
      fromBlock: 10,
      toBlock: 10,
      rpc: {
        readBlock: async () => ({
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
    store.applyFacts(restored.modelRows("Fragments").map(({ key, value }) => ({ model: "Fragments", key, value })));
    expect(store.require("Fragments", { game_id: 1, account: 273n }).balance).toBe(100n);
  });
});
