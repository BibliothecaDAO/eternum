import { existsSync, readFileSync } from "node:fs";
import { CallData } from "starknet";
import { expect, it, vi } from "vitest";
import { LaunchShard } from "./shard-client";
it("creates a complete roster once and recovers a lost acknowledgment from the existing game", async () => {
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
    const artifact = new URL(
      "../../../contracts/l3/world-native/target/dev/world_native_Games.contract_class.json",
      import.meta.url,
    );
    if (existsSync(artifact)) {
      const codec = new CallData(JSON.parse(readFileSync(artifact, "utf8")).abi);
      expect(codec.compile("create_game", payload as never).length).toBeGreaterThan(0);
    }
    throw new Error("lost acknowledgment");
  });
  vi.spyOn(native, "game").mockImplementation(
    async () =>
      ({
        preset_id: BigInt(String(params!.preset_id)),
        seed: BigInt(String(params!.seed)),
        start_main_at: 100n,
        end_at: 160n,
      }) as never,
  );
  const roster = [{ account: "0xa", wallet: "0x1" }];
  vi.spyOn(native, "roster").mockResolvedValue(roster);
  const request = {
    environment: "madara.blitz" as const,
    version: "2",
    gameName: "paid-retry",
    gameStartTime: new Date(100000).toISOString(),
    durationSeconds: 60,
  };
  await expect(native.create(request, 90000, undefined, roster)).rejects.toThrow("lost acknowledgment");
  expect((params as unknown as { roster: unknown }).roster).toEqual(roster);
  expect(await native.create(request, 90000, undefined, roster)).toMatchObject({ gameId: 7 });
  expect(create).toHaveBeenCalledOnce();
  await expect(native.create(request, 90000, undefined, [{ account: "0xb", wallet: "0x1" }])).rejects.toThrow(
    "frozen_roster_differs",
  );
  expect(create).toHaveBeenCalledOnce();
});
