import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hash, shortString } from "starknet";
import { WorldFold } from "../world-fold";
import type { DecodedWorldEvent, RpcReceipt, RpcTransaction } from "../types";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import { manifest, receipt, rowEvent } from "./fixtures";

const directory = new URL("../../../../contracts/l3/world-native/tests/fixtures/preset-projection/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, directory), "utf8");
const json = <T>(name: string): T => JSON.parse(read(name));
const felts = (name: string) => read(name).trim().split(/\s+/);

function contractFrames(name: string) {
  const values = felts(`${name}-rows.txt`);
  let index = 0;
  const next = () => {
    const value = values[index++];
    if (value === undefined) throw new Error("Truncated contract projection fixture");
    return value;
  };
  const span = () => Array.from({ length: Number(next()) }, next);
  const rows = Array.from({ length: Number(next()) }, () => {
    const model = shortString.decodeShortString(next());
    return { model, keys: span(), values: span() };
  });
  expect(index).toBe(values.length);
  return rows;
}

function contractRows(decoder: NativeDecoder, name: string): DecodedWorldEvent[] {
  return contractFrames(name).map(({ model, keys, values }) => decoder.decodeRowSet(model, keys, values));
}

function facts(rows: DecodedWorldEvent[]) {
  return rows
    .map(({ model, key, ...row }) => {
      if (row.kind !== "set") throw new Error("Expected a complete configuration fact");
      return { model: model.name, key, value: row.value };
    })
    .sort((a, b) =>
      `${a.model}:${Object.values(a.key).join(",")}`.localeCompare(`${b.model}:${Object.values(b.key).join(",")}`),
    );
}

describe("recorded launch configuration matches Cairo readers", () => {
  it("matches present spires and withdrawals, a non-roster Triple preset, and an explicit map override", () => {
    const decoder = new NativeDecoder(manifest);
    const ingestion = new NativeIngestion(decoder);
    const fold = new WorldFold(decoder.registry);
    const frames = contractFrames("optional-launch");
    const events = frames.map(({ model, keys, values }) => rowEvent(model, keys, values));
    const registration = felts("optional-register.txt");
    ingestion.applyReceipt(fold, receipt(events.slice(0, 1)), 10, 0, [
      "1",
      manifest.world.address,
      hash.getSelectorFromName("register_preset"),
      String(registration.length),
      ...registration,
    ]);
    const result = ingestion.applyReceipt(fold, receipt(events.slice(1)), 11, 0);
    const expected = facts(contractRows(decoder, "optional"));
    expect(facts(result.events.slice(result.decoded.length))).toEqual(expected);
    for (const model of ["SpireLayout", "DepositRules", "WithdrawalRules", "ResourceToken"])
      expect(expected.some((row) => row.model === model)).toBe(true);
    expect(
      BigInt((fold.gameRows("SliceRules", "1")[0]!.value.map_config as Record<string, string>).reward_resource_amount),
    ).toBe(987n);
  });
  it("replays every model and key for the recorded Blitz and Frontier launches", async () => {
    const first = json<RpcTransaction>("blitz-register-preset-transaction.json");
    const decoder = new NativeDecoder({ ...manifest, world: { address: first.calldata![1]! } });
    const ingestion = new NativeIngestion(decoder);
    const confirmed = new WorldFold(decoder.registry);
    const recorded: { receipt: RpcReceipt; transaction: RpcTransaction }[] = [];
    for (const name of ["blitz", "frontier"]) {
      const registration = json<RpcTransaction>(`${name}-register-preset-transaction.json`);
      const registered = json<RpcReceipt>(`${name}-register-preset-receipt.json`);
      const created = json<RpcReceipt>(`${name}-create-game-receipt.json`);
      const launch = json<RpcTransaction>(`${name}-create-game-transaction.json`);
      recorded.push({ receipt: registered, transaction: registration }, { receipt: created, transaction: launch });
      expect(registration.calldata!.slice(4).map(BigInt)).toEqual(felts(`${name}-register.txt`).map(BigInt));
      expect(launch.calldata!.slice(4).map(BigInt)).toEqual(felts(`${name}-create.txt`).map(BigInt));
      ingestion.applyReceipt(confirmed, registered, registered.block_number!, 0, registration.calldata);
      const overlay = confirmed.overlay();
      const pending = ingestion.applyReceipt(overlay, created, null, 0, launch.calldata);
      const result = ingestion.applyReceipt(confirmed, created, created.block_number!, 0, launch.calldata);
      const expected = facts(contractRows(decoder, name));
      expect(expected.length).toBeGreaterThan(156);
      expect(facts(result.events.slice(result.decoded.length))).toEqual(expected);
      expect(facts(pending.events.slice(pending.decoded.length))).toEqual(expected);
      const game = name === "blitz" ? 1 : 2;
      for (const [model, count] of [
        ["ResourceRule", 58],
        ["ProductionRecipe", 58],
        ["BuildingRule", 40],
      ] as const)
        expect(confirmed.gameRows(model, String(game))).toHaveLength(count);
      expect(confirmed.snapshot(game, created.block_number!)).toEqual(overlay.snapshot(game, created.block_number!));
      expect(BigInt(confirmed.gameRows("SettlementRules", String(game))[0]!.value.registration_limit as string)).toBe(
        name === "blitz" ? 1n : 0n,
      );
    }
    const replayed = new WorldFold(decoder.registry);
    const fromBlock = Math.min(...recorded.map(({ receipt }) => receipt.block_number!));
    const toBlock = Math.max(...recorded.map(({ receipt }) => receipt.block_number!));
    await ingestion.replay({
      fold: replayed,
      fromBlock,
      toBlock,
      rpc: {
        getBlockWithReceipts: async (block) => ({
          block_number: Number(block),
          timestamp: 0,
          transactions: recorded.filter(({ receipt }) => receipt.block_number === Number(block)),
        }),
      },
    });
    for (const game of [1, 2]) expect(replayed.snapshot(game, toBlock)).toEqual(confirmed.snapshot(game, toBlock));
  });
});
