import { gamesAbi, gamesEvent } from "../../../packages/value-ledger/test-support/abi";
import { CallData } from "starknet";
import { expect, it, vi } from "vitest";
import { LaunchShard } from "./shard-client";
it("recovers creation and seats the roster at close, five minutes before the common start", async () => {
  const native = new LaunchShard({
    rpcUrl: "https://shard.test",
    chainId: "0x1",
    gamesAddress: "0x77",
    accountAddress: "0x123",
    privateKey: "0x1",
  });
  let params: Record<string, unknown> | undefined;
  vi.spyOn(native, "gameId").mockImplementation(async () => (params ? 7 : 0));
  const create = vi.spyOn(native, "admin").mockImplementation(async (_entry, payload) => {
    params = (payload as { params: Record<string, unknown> }).params;
    const entry = gamesAbi.find((entry) => entry.name === "create_game")!;
    const fields = gamesAbi.find((type) => type.name === entry.inputs[0].type)!.members;
    expect(Object.keys(params).sort()).toEqual(fields.map((field: { name: string }) => field.name).sort());
    expect(new CallData(gamesAbi).compile("create_game", payload as never).length).toBeGreaterThan(0);
    throw new Error("lost acknowledgment");
  });
  let ready = false;
  vi.spyOn(native, "game").mockImplementation(
    async () =>
      ({
        preset_id: BigInt(String(params!.preset_id)),
        seed: BigInt(String(params!.seed)),
        ready,
        start_settling_at: BigInt(String(params!.start_settling_at)),
        start_main_at: BigInt(String(params!.start_main_at)),
        end_at: 460n,
      }) as never,
  );
  const roster = [{ account: "0xa", wallet: "0x1" }];
  vi.spyOn(native, "roster").mockResolvedValue(roster);
  const request = {
    environment: "madara.blitz" as const,
    version: "2",
    gameName: "paid-retry",
    gameStartTime: new Date(400000).toISOString(),
    durationSeconds: 60,
  };
  await expect(native.create(request, 100000, undefined, roster)).rejects.toThrow("lost acknowledgment");
  expect(params).toMatchObject({ roster, start_settling_at: 100, start_main_at: 400, registration_start: 99 });
  expect(await native.create(request, 100000, undefined, roster)).toMatchObject({ gameId: 7 });
  expect(create).toHaveBeenCalledOnce();
  await expect(native.create(request, 100000, undefined, [{ account: "0xb", wallet: "0x1" }])).rejects.toThrow(
    "frozen_roster_differs",
  );
  expect(create).toHaveBeenCalledOnce();
  vi.spyOn(native, "head").mockResolvedValue({ block_number: 10, block_hash: "0x10", timestamp: 100 });
  const seat = vi.spyOn(native, "playCommand").mockImplementation(async () => {
    ready = true;
    return {
      transactionHash: "0xabc",
      events: [
        {
          from_address: "0x77",
          ...gamesEvent("BatchProgress", { game_id: 7, actor: "0x123", tx_hash: "0xabc", remaining: 0 }),
        },
      ],
    };
  });
  await expect(native.seat(7)).resolves.toBe(1);
  expect(seat).toHaveBeenCalledWith(7, "SettleBlitzRoster");
});
