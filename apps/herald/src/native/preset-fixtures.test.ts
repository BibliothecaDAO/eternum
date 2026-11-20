import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { expect, it } from "vitest";
import { receipt, setup } from "./fixtures";
import { presetLaunch, presetRelease } from "./preset-fixtures";

it("replays a launch with frozen roster wallets into the shared client store", () => {
  const preset = presetRelease(2);
  const { native, fold } = setup(preset.definitions);
  native.applyReceipt(fold, receipt(presetLaunch(preset, 1, 100, [273, 546])), 10, 1);
  const store = new NativeFactStore();
  for (const model of ["GameRegistry", "BlitzRoster"] as const)
    store.applyFacts(fold.modelRows(model).map(({ key, value }) => ({ model, key, value })));
  expect(store.require("BlitzRoster", { game_id: 1 }).players).toEqual([
    { account: 273n, wallet: 273n },
    { account: 546n, wallet: 546n },
  ]);
  const game = store.require("GameRegistry", { game_id: 1 });
  expect(game.ready).toBe(true);
  expect(game).not.toHaveProperty("creator");
});
