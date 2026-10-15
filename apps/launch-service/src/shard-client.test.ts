import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";
import { CallData, shortString } from "starknet";
import { expect, it, vi } from "vitest";
import { LaunchShard } from "./shard-client";

it("launches a Blitz from its closed slot: creation parameters, settling time, one create, seats and its summary", async () => {
  const native = new LaunchShard({
    rpcUrl: "https://shard.test",
    chainId: "0x1",
    gamesAddress: "0x77",
    accountAddress: "0x123",
    privateKey: "0x1",
  });
  const roster = [{ account: "0xa", wallet: "0x1" }];
  const launch = {
    request: {
      environment: "madara.blitz" as const,
      version: "2",
      gameName: "paid-retry",
      gameStartTime: new Date(400000).toISOString(),
      durationSeconds: 60,
    },
    players: roster,
    createdAt: 100000,
  };
  let params: Record<string, unknown> | undefined;
  let seated = false;
  vi.spyOn(native, "gameId").mockImplementation(async () => (params ? 7 : 0));
  const create = vi.spyOn(native, "sendAdmin").mockImplementation(async (_entry, payload, nonce) => {
    params = (payload as { params: Record<string, unknown> }).params;
    const entry = gamesAbi.find((entry) => entry.name === "create_game")!;
    const fields = gamesAbi.find((type) => type.name === entry.inputs[0].type)!.members;
    expect(Object.keys(params).sort()).toEqual(fields.map((field: { name: string }) => field.name).sort());
    expect(new CallData(gamesAbi).compile("create_game", payload as never).length).toBeGreaterThan(0);
    expect(nonce).toBe(9n);
    return "0xc";
  });
  const closed = vi.spyOn(native, "awaitClosed").mockResolvedValue();
  vi.spyOn(native, "game").mockImplementation(
    async () =>
      ({
        preset_id: BigInt(String(params!.preset_id)),
        seed: BigInt(String(params!.seed)),
        ready: seated,
        start_settling_at: BigInt(String(params!.start_settling_at)),
        start_main_at: BigInt(String(params!.start_main_at)),
        end_at: 460n,
      }) as never,
  );
  vi.spyOn(native, "roster").mockResolvedValue(roster);
  const head = vi.spyOn(native, "head").mockResolvedValue({ block_number: 10, block_hash: "0x10", timestamp: 99 });
  await expect(native.launchBlitz([launch])).rejects.toMatchObject({ _tag: "RegistrationOpen", secondsUntilClose: 1 });
  expect(create).not.toHaveBeenCalled();

  head.mockResolvedValue({ block_number: 11, block_hash: "0x11", timestamp: 100 });
  const pins = { gameId: 7, release: 1n, commitment: 2n, l2GasBound: 3n };
  vi.spyOn(native, "pins").mockResolvedValue(pins);
  vi.spyOn(native, "pendingNonce").mockResolvedValueOnce(9n).mockResolvedValue(10n);
  const send = vi.spyOn(native, "sendSeat").mockResolvedValue("0xabc");
  vi.spyOn(native, "seatOutcome").mockImplementation(async () => {
    seated = true;
    return { remaining: 0n };
  });
  expect(await native.launchBlitz([launch])).toEqual([
    expect.objectContaining({
      gameName: "paid-retry",
      gameId: 7,
      startTime: 400,
      durationSeconds: 60,
      finalizeAt: 460,
      settlementTransactions: 1,
    }),
  ]);
  expect(params).toMatchObject({ roster, start_settling_at: 100, start_main_at: 400, registration_start: 99 });
  expect(closed).toHaveBeenCalledWith("0xc");
  expect(send).toHaveBeenCalledWith(pins, 10n);

  // A retry finds the game and refuses one whose stored roster differs, before any write.
  await expect(native.launchBlitz([{ ...launch, players: [{ account: "0xb", wallet: "0x1" }] }])).rejects.toThrow(
    "frozen_roster_differs",
  );
  expect(create).toHaveBeenCalledOnce();
});

/**
 * A shard whose games keep the release they were created in: `existing` names the games already on it with their
 * release, and a game created now takes `currentRelease`. Each game seats one player; a seat carrying another game's
 * release is refused by the contract, as `games_entry` does.
 */
const releasedShard = (existing: Record<string, number>, currentRelease: number) => {
  const native = new LaunchShard({
    rpcUrl: "https://shard.test",
    chainId: "0x1",
    gamesAddress: "0x77",
    accountAddress: "0x123",
    privateKey: "0x1",
  });
  const roster = [{ account: "0xa", wallet: "0x1" }];
  const launches = ["game-1", "game-2"].map((gameName) => ({
    request: {
      environment: "madara.blitz" as const,
      version: "2",
      gameName,
      gameStartTime: new Date(400000).toISOString(),
      durationSeconds: 60,
    },
    players: roster,
    createdAt: 100000,
  }));
  const games = new Map<string, { id: number; release: number; seed: bigint; ready: boolean }>();
  const seedOf = (params: unknown) => BigInt(String((params as { seed: unknown }).seed));
  let nonce = 0n;
  const seats = new Map<string, { gameId: number; release: bigint }>();
  return {
    native,
    launches,
    games,
    /** Puts the games named in `existing` on the shard, unseated, with the seed this launch would give them. */
    async seedExisting() {
      for (const launch of launches) {
        if (existing[launch.request.gameName] === undefined) continue;
        const params = await (
          native as unknown as { creationParams: (...args: unknown[]) => Promise<unknown> }
        ).creationParams(launch.request, launch.createdAt, launch.players);
        const id = games.size + 1;
        games.set(launch.request.gameName, {
          id,
          release: existing[launch.request.gameName]!,
          seed: seedOf(params),
          ready: false,
        });
      }
    },
    stub() {
      const byId = (id: number) => [...games.values()].find((game) => game.id === id)!;
      vi.spyOn(native, "head").mockResolvedValue({ block_number: 10, block_hash: "0xa", timestamp: 100 });
      vi.spyOn(native, "gameId").mockImplementation(async (name) => games.get(name)?.id ?? 0);
      vi.spyOn(native, "sendAdmin").mockImplementation(async (_entry, payload) => {
        const params = (payload as { params: { name: unknown } }).params;
        const name = shortString.decodeShortString(String(params.name));
        games.set(name, { id: games.size + 1, release: currentRelease, seed: seedOf(params), ready: false });
        nonce++;
        return "0xc";
      });
      vi.spyOn(native, "awaitClosed").mockResolvedValue();
      vi.spyOn(native, "game").mockImplementation(
        async (id) =>
          ({
            preset_id: 2n,
            seed: byId(id).seed,
            ready: byId(id).ready,
            start_settling_at: 100n,
            start_main_at: 400n,
            end_at: 460n,
          }) as never,
      );
      vi.spyOn(native, "roster").mockResolvedValue(roster);
      const pins = vi.spyOn(native, "pins").mockImplementation(async (gameId) => ({
        gameId,
        release: BigInt(byId(gameId).release),
        commitment: 2n,
        l2GasBound: 3n,
      }));
      vi.spyOn(native, "pendingNonce").mockImplementation(async () => nonce);
      vi.spyOn(native, "sendSeat").mockImplementation(async (pin, sentAt) => {
        seats.set(`0x${sentAt}`, { gameId: pin.gameId, release: pin.release });
        nonce = sentAt + 1n;
        return `0x${sentAt}`;
      });
      vi.spyOn(native, "seatOutcome").mockImplementation(async (gameId, hash) => {
        if (seats.get(hash)!.release !== BigInt(byId(gameId).release)) return "spent";
        byId(gameId).ready = true;
        return { remaining: 0n };
      });
      return { pins, seats: () => [...seats.values()] };
    },
  };
};

it("seats each recovered game with its own release, however the releases differ", async () => {
  const shard = releasedShard({ "game-1": 1, "game-2": 2 }, 2);
  await shard.seedExisting();
  const { pins, seats } = shard.stub();
  await shard.native.launchBlitz(shard.launches);
  expect([...shard.games.values()].map(({ ready }) => ready)).toEqual([true, true]);
  expect(seats()).toEqual([
    { gameId: 1, release: 1n },
    { gameId: 2, release: 2n },
  ]);
  expect(pins.mock.calls.map(([gameId]) => gameId).sort()).toEqual([1, 2]);
});

it("seats an old game with its release beside a game created after a release change", async () => {
  const shard = releasedShard({ "game-1": 1 }, 2);
  await shard.seedExisting();
  const { seats } = shard.stub();
  await shard.native.launchBlitz(shard.launches);
  expect(shard.native.sendAdmin).toHaveBeenCalledOnce();
  expect([...shard.games.values()].map(({ id, release, ready }) => [id, release, ready])).toEqual([
    [1, 1, true],
    [2, 2, true],
  ]);
  // The new game's seat goes out in the fresh pipeline, the recovered game's in its top-up: each carries its own release.
  expect(seats()).toEqual([
    { gameId: 2, release: 2n },
    { gameId: 1, release: 1n },
  ]);
});
