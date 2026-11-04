import { CairoCustomEnum, CairoOption, CairoOptionVariant, hash } from "starknet";
import { encodeMembers } from "./serde";
import { currentPresetFixture } from "./current-preset-fixture";
import { presetPreimageCommitment } from "./preset-preimages";
import { expect, it, vi } from "vitest";
import { SEASON_ZERO_COMPETITION as policy, type HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { replayWithFrontierDays } from "./frontier-day-ranks";
import { receipt, rowEvent, rulesEvent, seedDerivedRows, setup, structureValue, manifest, schema } from "./fixtures";
import { WorldFold } from "../world-fold";
import { loadNativeWorld } from "./load";
import type { MadaraRpc } from "../madara-rpc";
import { buildFrontierLeaderboard } from "./frontier-leaderboard";

const gameEvent = () =>
  rowEvent("GameRegistry", ["1"], {
    game_id: 1,
    name: 1,
    creator: 1,
    preset_id: policy.presetId,
    seed: policy.seed,
    ready: true,
    dev_mode_on: false,
    settled: false,
    start_settling_at: policy.start,
    start_main_at: policy.start,
    end_at: policy.cutoff + 7 * 86400,
    end_grace_seconds: 0,
  });
const home = (owner: number, depth: number) =>
  rowEvent("Structure", ["1", String(owner)], {
    ...structureValue,
    owner,
    base: { ...structureValue.base, category: 1 },
    metadata: { ...structureValue.metadata, deepest_depth: depth },
  });
const clear = (owner: number, timestamp: number) => {
  const layout = schema.games.events.find((event) => event.name === "StoryEvent")!;
  const values = {
    version: 2,
    game_id: 1,
    owner: new CairoOption(CairoOptionVariant.Some, owner),
    entity_id: new CairoOption(CairoOptionVariant.Some, owner),
    tx_hash: 85,
    timestamp,
    story: new CairoCustomEnum({
      SitePayout: {
        structure_id: owner,
        explorer_id: 7,
        site_id: 9,
        category: 7,
        reward: new CairoOption(CairoOptionVariant.None),
      },
    }),
  };
  return {
    from_address: manifest.world.address,
    keys: [
      ...layout.prefix,
      ...encodeMembers(
        schema,
        layout.members.filter((m) => m.kind === "key"),
        values,
      ),
    ],
    data: encodeMembers(
      schema,
      layout.members.filter((m) => m.kind === "data"),
      values,
    ),
  };
};

const history: HeraldHistoryEvent[] = [1, 2].map((owner) => ({
  game_id: "1",
  model: "StoryEvent",
  block_number: 10,
  transaction_index: 0,
  event_index: owner,
  transaction_hash: "0x10",
  value: { owner, story: { SitePayout: { category: 7, reward: null } } },
}));

it("freezes the last pre-cutoff depth tie and excludes same-second/new-home changes; SQL failure cannot advance state", async () => {
  const { native, decoder, fold } = setup();
  native.applyReceipt(fold, receipt([gameEvent(), home(1, 1), home(2, 2)]), 10, 0);
  seedDerivedRows(fold, decoder, [rulesEvent("1", "7200")]);
  const original = fold.checkpoint();
  const blocks = [
    {
      block_number: 11,
      timestamp: policy.cutoff - 1,
      transactions: [{ transaction: { type: "INVOKE" }, receipt: receipt([home(1, 3)]) }],
    },
    {
      block_number: 12,
      timestamp: policy.cutoff,
      transactions: [
        { transaction: { type: "INVOKE" }, receipt: receipt([home(2, 99), home(3, 100), clear(2, policy.cutoff)]) },
      ],
    },
  ];
  const rpc = {
    readBlock: async (number: number) => blocks[number - 11]!,
    getBlockHeader: async (number: number) => ({
      block_number: number,
      timestamp: number === 10 ? policy.cutoff - 2 : policy.cutoff - 1,
      block_hash: `0x${number}`,
    }),
  };
  const store = { frontierHistory: vi.fn(async () => history), appendEvents: vi.fn(async () => {}) };
  const input = { chain: policy.chainId, fold, rpc, fromBlock: 11, toBlock: 12 };
  const result = await replayWithFrontierDays(native, store, input);
  const frozen = result.prizeBoards[0]!;
  expect(frozen).toMatchObject({ game_id: "1", cutoff: policy.cutoff, confirmed_block: 11, block_hash: "0x11" });
  expect(frozen.entries.map((e) => [e.address, e.sites_cleared.total, e.deepest_depth])).toEqual([
    ["0x1", 1, 3],
    ["0x2", 1, 2],
  ]);
  expect(buildFrontierLeaderboard((m) => fold.modelRows(m), "1", history).entries[0]!.address).toBe("0x2");
  expect(store.appendEvents.mock.calls[0]).toEqual([
    [expect.objectContaining({ kind: "event" })],
    12,
    result.frontierDays,
    result.prizeBoards,
  ]);
  const restored = WorldFold.restore(decoder.registry, original);
  expect((await replayWithFrontierDays(native, store, { ...input, fold: restored })).prizeBoards).toEqual(
    result.prizeBoards,
  );
  const uncommitted = WorldFold.restore(decoder.registry, original);
  store.appendEvents.mockRejectedValueOnce(new Error("SQL unavailable"));
  await expect(replayWithFrontierDays(native, store, { ...input, fold: uncommitted })).rejects.toThrow(
    "SQL unavailable",
  );
  expect(uncommitted.checkpoint()).toEqual(original);
  expect(
    (
      await replayWithFrontierDays(native, store, {
        ...input,
        fold: WorldFold.restore(decoder.registry, original),
        chain: "0x123",
      })
    ).prizeBoards,
  ).toEqual([]);
});

it("reconstructs the cutoff from launch receipts when a post-cutoff checkpoint has no durable board", async () => {
  const { native, fold } = setup();
  native.applyReceipt(fold, receipt([gameEvent()]), 10, 0);
  const preset = await currentPresetFixture(policy.presetId);
  const commitment = presetPreimageCommitment(preset.registration.slice(1));
  const launch = [
    rowEvent("Preset", [String(policy.presetId)], { commitment }),
    gameEvent(),
    rowEvent("GameOverrides", ["1"], {
      registration_start: policy.start,
      biome_climate: preset.definition.rules.biome_climate_config,
      map: new CairoOption(CairoOptionVariant.None),
      map_center_offset: 0,
    }),
    rowEvent("GameRelease", ["1"], { release_id: 1, created_release_id: 1, preset_commitment: commitment }),
    home(1, 1),
    home(2, 2),
    clear(1, policy.cutoff - 3),
    clear(2, policy.cutoff - 3),
  ];
  const blocks = [
    {
      block_number: 10,
      timestamp: policy.cutoff - 3,
      transactions: [
        {
          transaction: {
            type: "INVOKE",
            calldata: [
              "1",
              manifest.world.address,
              hash.getSelectorFromName("register_preset"),
              String(preset.registration.length),
              ...preset.registration,
            ],
          },
          receipt: receipt(launch, "0x10"),
        },
      ],
    },
    {
      block_number: 11,
      timestamp: policy.cutoff - 1,
      transactions: [{ transaction: { type: "INVOKE" }, receipt: receipt([home(1, 3)], "0x11") }],
    },
    {
      block_number: 12,
      timestamp: policy.cutoff,
      transactions: [
        { transaction: { type: "INVOKE" }, receipt: receipt([home(2, 99), clear(2, policy.cutoff)], "0x12") },
      ],
    },
  ];
  const rpc = {
    blockNumber: async () => 12,
    getBlockHeader: async (n: number) => ({ ...blocks[n - 10]!, block_hash: `0x${n}` }),
    readBlock: vi.fn(async (n: number) => blocks[n - 10]),
  } as unknown as MadaraRpc;
  const checkpointStore = { initialize: vi.fn(), load: async () => ({ fold, confirmedBlock: 12 }), save: vi.fn() };
  const store = {
    historyProgress: async () => 12,
    frontierPrizeBoard: vi.fn(async () => null),
    frontierHistory: vi.fn(async () => []),
    appendEvents: vi.fn(),
  };
  const result = await loadNativeWorld({ chain: policy.chainId, native, rpc, checkpointStore, history: store });
  expect(store.frontierPrizeBoard).toHaveBeenCalledWith("1", policy.cutoff);
  expect(result.fold).not.toBe(fold);
  expect(rpc.readBlock).toHaveBeenCalledTimes(3);
  const frozen = store.appendEvents.mock.calls[0]![3][0];
  expect(frozen).toMatchObject({ cutoff: policy.cutoff, confirmed_block: 11, block_hash: "0x11" });
  expect(
    frozen.entries.map((e: { address: string; sites_cleared: { total: number }; deepest_depth: number }) => [
      e.address,
      e.sites_cleared.total,
      e.deepest_depth,
    ]),
  ).toEqual([
    ["0x1", 1, 3],
    ["0x2", 1, 2],
  ]);
  expect(store.frontierHistory).not.toHaveBeenCalled();
  expect(
    result.fold.modelRows("Structure").find((row) => BigInt(row.value.owner as string) === 2n)?.value.metadata,
  ).toMatchObject({ deepest_depth: "0x63" });
});
