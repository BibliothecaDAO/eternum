import { expect, it } from "vitest";
import { dayOf } from "../../../../packages/core/src/utils/days";
import { buildNativeDirectory } from "./read-models";
import type { DirectoryInput } from "../game-directory";
import type { FoldRow } from "../types";

const start = 1_800_000_000;
const calendar = { seed: 42n, startMainAt: start, dayUnitSeconds: 14_400 };
const input = (timestamp: number): DirectoryInput => {
  const games = [
    { game_id: 1, preset_id: 5, settled: true },
    { game_id: 2, preset_id: 2, settled: false },
    { game_id: 3, preset_id: 5, settled: false },
  ].map((game) => ({
    ...game,
    name: "0x536561736f6e",
    creator: "0x1",
    ready: true,
    dev_mode_on: false,
    start_settling_at: start - 100,
    start_main_at: start,
    end_at: start + 21 * 20 * 14_400,
    end_grace_seconds: 0,
    seed: 42n,
  }));
  const rows: Record<string, Record<string, unknown>[]> = {
    GameRegistry: games,
    SliceRules: games.map((game) => ({ game_id: game.game_id, day_unit_seconds: game.preset_id === 5 ? 14_400 : 0 })),
    SettlementRules: games.map((game) => ({
      game_id: game.game_id,
      registration_limit: 0,
      registration_start: 0,
      mode: "Single",
      spacing: 40,
    })),
  };
  return {
    chain: "0xa",
    confirmedBlock: 10,
    timestamp,
    fold: {
      modelRows: (model) => (rows[model] ?? []).map((value, index) => ({ key: String(index), value })) as FoldRow[],
      structurePosition: () => undefined,
      directoryRevision: () => 0,
    },
  };
};

it("publishes each seeded day, tomorrow's duration and a stable Frontier-only season ordinal", () => {
  let timestamp = start;
  for (let index = 0; index < 6; index++) {
    const day = dayOf(calendar, timestamp)!;
    const entry = buildNativeDirectory(input(timestamp)).games.find((game) => game.game_id === 3)!;
    expect(entry).toMatchObject({
      day_index: day.index,
      day_ends_at: day.end,
      next_day_length: dayOf(calendar, day.end)!.end - day.end,
      season_number: 2,
    });
    timestamp = day.end;
  }
  expect(buildNativeDirectory(input(start)).games.find((game) => game.game_id === 2)).toMatchObject({
    day_index: null,
    day_ends_at: null,
    next_day_length: null,
    season_number: null,
  });
});

it("never invents a current day before main starts or after the season closes", () => {
  for (const timestamp of [start - 1, start + 21 * 20 * 14_400])
    expect(buildNativeDirectory(input(timestamp)).games.find((game) => game.game_id === 3)).toMatchObject({
      day_index: null,
      day_ends_at: null,
      next_day_length: null,
      season_number: 2,
    });
});

it("keeps missing rules loud instead of returning a made-up day", () => {
  const state = input(start);
  const rows = state.fold.modelRows;
  state.fold.modelRows = (model) => (model === "SliceRules" ? [] : rows(model));
  expect(() => buildNativeDirectory(state)).toThrow("SliceRules");
});

it("does not require a season seed for a game without a day schedule", () => {
  const state = input(start);
  const blitz = state.fold.modelRows("GameRegistry").find(({ value }) => value.game_id === 2)!;
  delete blitz.value.seed;
  expect(buildNativeDirectory(state).games.find((game) => game.game_id === 2)).toMatchObject({ day_index: null });
});

it("folds the extension row and preserves the added days through a checkpoint reload", async () => {
  const { default: approved } = await import("../../../../config/source/frontier/extension.json");
  const { setup, rowEvent, receipt, seedDerivedRows, rulesEvent } = await import("./fixtures");
  const { WorldFold } = await import("../world-fold");
  const { shortString, CairoCustomEnum } = await import("starknet");
  const { fold, native, decoder } = setup();
  const game = {
    game_id: 1,
    name: shortString.encodeShortString(approved.name),
    preset_id: approved.presetId,
    creator: 1,
    ready: true,
    settled: false,
    dev_mode_on: false,
    start_main_at: approved.start,
    start_settling_at: approved.start,
    end_at: approved.oldEnd,
    end_grace_seconds: 0,
    seed: BigInt(approved.seed),
  };
  native.applyReceipt(fold, receipt([rowEvent("GameRegistry", ["1"], game)]), 10, 0);
  seedDerivedRows(fold, decoder, [
    rulesEvent("1", String(approved.dayUnit)),
    rowEvent("SettlementRules", ["1"], {
      game_id: 1,
      registration_limit: 0,
      registration_start: 0,
      mode: new CairoCustomEnum({ Single: {} }),
      spacing: 40,
    }),
  ]);
  const directory = (state: typeof fold, timestamp: number) =>
    buildNativeDirectory({
      chain: approved.chainId,
      confirmedBlock: 11,
      timestamp,
      fold: state,
    }).games[0]!;
  expect(directory(fold, approved.oldEnd).day_index).toBeNull();
  native.applyReceipt(fold, receipt([rowEvent("GameRegistry", ["1"], { ...game, end_at: approved.end })]), 11, 0);
  expect(directory(fold, approved.oldEnd)).toMatchObject({ day_index: 10, clock: { end_at: approved.end } });
  const cold = WorldFold.restore(decoder.registry, JSON.parse(JSON.stringify(fold.checkpoint())));
  expect(directory(cold, approved.oldEnd)).toEqual(directory(fold, approved.oldEnd));
  expect(directory(cold, approved.end - 1)).toMatchObject({ day_index: 14, day_ends_at: approved.end });
  expect(directory(cold, approved.end).day_index).toBeNull();
});
