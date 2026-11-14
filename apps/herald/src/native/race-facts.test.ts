import { describe, expect, it } from "vitest";
import { CairoOption, CairoOptionVariant } from "starknet";
import { NativeFactStore } from "../../../../packages/core/src/client/native-fact-store";
import { receipt, rowEvent, setup } from "./fixtures";

const models = ["RaceMember", "AspectHyperstructure", "TriumphDay", "RaceResult"] as const;

describe("race facts through confirmed event ingestion", () => {
  it("retains exact Glory, Aspect keys, Triumph day and both finish dates in the snapshot", () => {
    const world = setup();
    world.native.applyReceipt(
      world.fold,
      receipt([
        rowEvent("RaceMember", ["1", "7"], { glory: 1250000000001n, contribution: 1300000000000n }),
        rowEvent("AspectHyperstructure", ["1", "2"], { entity_id: 902n, height: 10000 }),
        rowEvent("TriumphDay", ["1", "2", "4"], { day: 9n }),
        rowEvent("RaceResult", ["1"], {
          winner: new CairoOption(CairoOptionVariant.Some, 2),
          ended_at: 720n,
          scheduled_end_at: 86400n,
        }),
      ]),
      10,
      0,
    );
    const snapshot = () => {
      const store = new NativeFactStore();
      for (const model of models)
        store.applyFacts(world.fold.gameRows(model, "1").map(({ key, value }) => ({ model, key, value })));
      return store;
    };
    const store = snapshot();
    expect(store.get("RaceMember", { game_id: 1, entity_id: 7 })).toEqual({
      game_id: 1,
      entity_id: 7n,
      glory: 1250000000001n,
      contribution: 1300000000000n,
    });
    expect(store.get("AspectHyperstructure", { game_id: 1, aspect: 2 })).toEqual({
      game_id: 1,
      aspect: 2,
      entity_id: 902n,
      height: 10000,
    });
    expect(store.get("TriumphDay", { game_id: 1, aspect: 2, stage: 4 })).toEqual({
      game_id: 1,
      aspect: 2,
      stage: 4,
      day: 9n,
    });
    expect(store.get("RaceResult", { game_id: 1 })).toEqual({
      game_id: 1,
      winner: 2,
      ended_at: 720n,
      scheduled_end_at: 86400n,
    });
    for (const model of models) expect([...snapshot().inGame(model, 1)]).toEqual([...store.inGame(model, 1)]);
  });
});
