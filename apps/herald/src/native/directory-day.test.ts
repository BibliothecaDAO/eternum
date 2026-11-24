import { shortString } from "starknet";
import { expect, it } from "vitest";
import { dayOf } from "../../../../packages/core/src/utils/days";
import { buildNativeDirectory } from "./read-models";
import type { DirectoryInput } from "../game-directory";
import type { FoldRow } from "../types";
import { gameRegistryRow } from "../../../../packages/core/src/test-support/game-registry";
import { GAME_FAMILIES } from "../../../../config/source/common/native-preset-modes";

const start = 1_800_000_000;
const calendar = {
  seed: 42n,
  startMainAt: start,
  scheduledEndAt: start + 21 * 20 * 14_400,
  endAt: start + 21 * 20 * 14_400,
  dayUnitSeconds: 14_400,
};
const input = (timestamp: number): DirectoryInput => {
  const dayUnits = [
    { game_id: 1, settled: true, family: GAME_FAMILIES.frontier, day_unit_seconds: 14_400, name: "frontier-1" },
    { game_id: 2, settled: false, family: GAME_FAMILIES.blitz, day_unit_seconds: 0, name: "blitz-2" },
    { game_id: 3, settled: false, family: GAME_FAMILIES.frontier, day_unit_seconds: 14_400, name: "testnet-3" },
    { game_id: 4, settled: false, family: GAME_FAMILIES.frontier, day_unit_seconds: 14_400, name: "frontier-4" },
  ];
  const games = dayUnits.map(({ game_id, settled, family, name }) =>
    gameRegistryRow({
      game_id,
      settled,
      family,
      name: shortString.encodeShortString(name),
      start_settling_at: String(start - 100),
      start_main_at: String(start),
      scheduled_end_at: String(start + 21 * 20 * 14_400),
      end_at: String(start + 21 * 20 * 14_400),
      seed: "42",
    }),
  );
  const rows: Record<string, Record<string, unknown>[]> = {
    GameRegistry: games,
    SliceRules: dayUnits.map(({ game_id, day_unit_seconds }) => ({ game_id, day_unit_seconds })),
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

it("publishes each seeded day, tomorrow's duration and a season number counted from 1 over season-named games only", () => {
  let timestamp = start;
  for (let index = 0; index < 6; index++) {
    const day = dayOf(calendar, timestamp)!;
    const entry = buildNativeDirectory(input(timestamp)).games.find((game) => game.game_id === 4)!;
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
  expect(buildNativeDirectory(input(start)).games.find((game) => game.game_id === 1)).toMatchObject({
    season_number: 1,
  });
  expect(buildNativeDirectory(input(start)).games.find((game) => game.game_id === 3)).toMatchObject({
    season_number: null,
  });
});

it("never invents a current day before main starts or after the season closes", () => {
  for (const timestamp of [start - 1, start + 21 * 20 * 14_400])
    expect(buildNativeDirectory(input(timestamp)).games.find((game) => game.game_id === 4)).toMatchObject({
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
  const approved = {
    chainId: "0x50524f44554354494f4e5f31386530376435323330633539393933",
    name: "frontier-1792575960",
    start: 1792575960,
    oldEnd: 1793151960,
    end: 1793439960,
    seed: "0x5b0a63f717733291c17fc3ecf7ead6e4bd6ae7157150430908152aad0d4ef09",
    dayUnit: 14400,
  };
  const { setup, gameRegistryEvent, rowEvent, receipt, seedDerivedRows, rulesEvent } = await import("./fixtures");
  const { WorldFold } = await import("../world-fold");
  const { shortString, CairoCustomEnum } = await import("starknet");
  const { fold, native, decoder } = setup();
  const game = {
    name: shortString.encodeShortString(approved.name),
    start_main_at: String(approved.start),
    start_settling_at: String(approved.start),
    scheduled_end_at: String(approved.oldEnd),
    end_at: String(approved.oldEnd),
    seed: String(BigInt(approved.seed)),
  };
  native.applyReceipt(fold, receipt([gameRegistryEvent(game)]), 10, 0);
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
  native.applyReceipt(
    fold,
    receipt([gameRegistryEvent({ ...game, end_at: String(approved.end), scheduled_end_at: String(approved.end) })]),
    11,
    0,
  );
  expect(directory(fold, approved.oldEnd)).toMatchObject({ day_index: 10, clock: { end_at: approved.end } });
  const cold = WorldFold.restore(decoder.registry, JSON.parse(JSON.stringify(fold.checkpoint())));
  expect(directory(cold, approved.oldEnd)).toEqual(directory(fold, approved.oldEnd));
  expect(directory(cold, approved.end - 1)).toMatchObject({ day_index: 14, day_ends_at: approved.end });
  expect(directory(cold, approved.end).day_index).toBeNull();
});

it.each([81, 84, 85])("publishes the final %ih day without a tomorrow", (hours) => {
  const end = start + hours * 3600;
  const state = input(end - 1);
  const read = state.fold.modelRows;
  state.fold.modelRows = (model) =>
    read(model).map((row) => ({
      ...row,
      value: {
        ...row.value,
        ...(model === "GameRegistry" ? { seed: 0x5eedn, end_at: end, scheduled_end_at: end } : {}),
        ...(model === "SliceRules" && row.value.game_id === 3 ? { day_unit_seconds: 7200 } : {}),
      },
    }));
  expect(buildNativeDirectory(state).games.find((game) => game.game_id === 3)).toMatchObject({
    day_index: hours === 81 ? 9 : 10,
    day_ends_at: end,
    next_day_length: null,
  });
});
