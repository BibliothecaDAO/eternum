import { describe, expect, it, vi } from "vitest";
import { CallData, CairoOption, CairoOptionVariant, hash, type Abi } from "starknet";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { LiveWorld } from "../live-world";
import type { MadaraRpc } from "../madara-rpc";
import { WorldFold } from "../world-fold";
import type { RpcEvent } from "../types";
import { manifest, receipt, rowEvent, schema, setup } from "./fixtures";
import { encodeMembers } from "./serde";
import { presetPreimageCommitment } from "./preset-preimages";

const codec = new CallData([...Object.values(schema.types), ...schema.games.entrypoints] as Abi);

function registration(presetId = 5) {
  const environment = presetId === 2 ? "madara.blitz" : "madara.frontier";
  const definition = buildNativePreset(loadNativePresetConfiguration(environment, presetId), presetId);
  const calldata = codec.compile("register_preset", { preset_id: presetId, definition });
  const commitment = presetPreimageCommitment(calldata.slice(1));
  const accountCalldata = [
    "1",
    manifest.world.address,
    hash.getSelectorFromName("register_preset"),
    String(calldata.length),
    ...calldata,
  ];
  return {
    presetId,
    definition,
    commitment,
    accountCalldata,
    event: rowEvent("Preset", [String(presetId)], [commitment]),
  };
}

function launch(preset: ReturnType<typeof registration>, gameId = 1, rosterSize = 0, overrideMap = true): RpcEvent[] {
  const overrides = {
    registration_start: 1234,
    biome_climate: preset.definition.rules.biome_climate_config,
    map: new CairoOption(overrideMap ? CairoOptionVariant.Some : CairoOptionVariant.None, {
      ...preset.definition.rules.map_config,
      reward_resource_amount: 987,
    }),
    map_center_offset: 4321,
  };
  const members = schema.models.find(({ name }) => name === "GameOverrides")!.members;
  const roster = Array.from({ length: rosterSize }, (_, index) => [String(0x100 + index)]);
  return [
    ...(rosterSize ? [rowEvent("BlitzRoster", [String(gameId)], [String(rosterSize), ...roster.flat()])] : []),
    rowEvent(
      "GameRegistry",
      [String(gameId)],
      ["0x123", String(preset.presetId), "0x111", "0", "1", "0", "1800", "1800", "999999", "0", "1"],
    ),
    rowEvent("GameOverrides", [String(gameId)], encodeMembers(schema, members, overrides)),
    rowEvent("GameRelease", [String(gameId)], ["1", preset.commitment]),
  ];
}

function applyRegistration(world: ReturnType<typeof setup>, preset: ReturnType<typeof registration>) {
  return world.native.applyReceipt(world.fold, receipt([preset.event]), 10, 0, preset.accountCalldata);
}

describe("verified preset configuration facts", () => {
  it("derives the complete launch config, preserving the chain's overrides", () => {
    const world = setup();
    const preset = registration();
    applyRegistration(world, preset);
    world.native.applyReceipt(world.fold, receipt(launch(preset)), 11, 0);
    expect(world.fold.gameRows("ResourceRule", "1")).toHaveLength(58);
    expect(world.fold.gameRows("ProductionRecipe", "1")).toHaveLength(58);
    expect(world.fold.gameRows("BuildingRule", "1")).toHaveLength(40);
    expect(world.fold.gameRows("GameOverrides", "1")).toHaveLength(1);
    for (const scope of [undefined, {}, world.fold.subscriptionScope("1", "0x123", 1234)]) {
      const snapshot = world.fold.snapshot(1, 11, undefined, scope);
      expect(snapshot.models.map(({ model }) => model)).not.toContain("GameOverrides");
    }
    expect(() => world.fold.snapshot(1, 11, ["GameOverrides"])).toThrow("Unknown snapshot models");
    for (const name of ["ProductionReady", "BuildingRulesReady", "ResourceRulesReady"])
      expect(schema.models.map(({ name }) => name)).not.toContain(name);
    const rules = world.fold.gameRows("SliceRules", "1")[0]!.value;
    expect(BigInt(rules.map_center_offset as string)).toBe(4321n);
    expect(BigInt((rules.map_config as Record<string, string>).reward_resource_amount)).toBe(987n);
    const settlement = world.fold.gameRows("SettlementRules", "1")[0]!.value;
    expect(BigInt(settlement.registration_start as string)).toBe(1234n);
    expect(BigInt(settlement.registration_limit as string)).toBe(0n);
  });

  it("takes Blitz registration_limit from the immutable launch roster", () => {
    const world = setup();
    const preset = registration(2);
    applyRegistration(world, preset);
    world.native.applyReceipt(world.fold, receipt(launch(preset, 1, 2)), 11, 0);
    expect(BigInt(world.fold.gameRows("SettlementRules", "1")[0]!.value.registration_limit as string)).toBe(2n);
  });

  it("refuses a mismatched preimage and an unknown call path without partial state", () => {
    const world = setup();
    const preset = registration();
    const before = world.fold.checkpoint();
    const wrong = [...preset.accountCalldata];
    wrong[wrong.length - 1] = "99";
    expect(() => world.native.applyReceipt(world.fold, receipt([preset.event]), 10, 0, wrong)).toThrow(
      "commitment mismatch",
    );
    expect(world.fold.checkpoint()).toEqual(before);
    const unknown = [...preset.accountCalldata];
    unknown[2] = hash.getSelectorFromName("unrecognized_registration");
    expect(() => world.native.applyReceipt(world.fold, receipt([preset.event]), 10, 0, unknown)).toThrow(
      "preset registration must be a direct authority account call",
    );
    expect(world.fold.checkpoint()).toEqual(before);
    expect(() => world.native.applyReceipt(world.fold, receipt([preset.event]), 10, 0, ["99"])).toThrow(
      "preset registration must be a direct authority account call",
    );
    expect(world.fold.checkpoint()).toEqual(before);
  });

  it("ignores reverted registration, and restores verified preimages across checkpoints and overlays", () => {
    const world = setup();
    const preset = registration();
    const before = world.fold.checkpoint();
    world.native.applyReceipt(
      world.fold,
      { ...receipt([preset.event]), execution_status: "REVERTED" },
      10,
      0,
      preset.accountCalldata,
    );
    expect(world.fold.checkpoint()).toEqual(before);
    applyRegistration(world, preset);
    const restored = WorldFold.restore(world.decoder.registry, world.fold.checkpoint());
    const overlay = restored.overlay();
    world.native.applyReceipt(overlay, receipt(launch(preset)), null, 0);
    expect(restored.gameRows("ResourceRule", "1")).toHaveLength(0);
    world.native.applyReceipt(restored, receipt(launch(preset)), 11, 0);
    expect(restored.snapshot(1, 11)).toEqual(overlay.snapshot(1, 11));
  });
  it("defers a pre-confirmed registration until calldata arrives, then derives its launch atomically", () => {
    const world = setup();
    const preset = registration();
    const live = new LiveWorld({
      native: world.native,
      registry: world.decoder.registry,
      chain: "madara",
      checkpointEveryBlocks: 100,
      checkpointStore: { save: vi.fn() },
      confirmedBlock: 9,
      confirmedFold: world.fold,
      rpc: {} as MadaraRpc,
    });
    const messages: Record<string, unknown>[] = [];
    const session = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) });
    live.resume(session, { epoch: "previous", seq: 0, type: "resume" });
    messages.length = 0;
    const pending = { ...receipt([preset.event], "0x99"), finality_status: "PRE_CONFIRMED" };
    live.acceptReceipt(pending);
    expect(world.native.receiptFailures).toBe(0);
    expect(world.fold.checkpoint().preset_preimages).toEqual([]);
    live.acceptTransaction({
      type: "INVOKE",
      transaction_hash: "0x99",
      finality_status: "PRE_CONFIRMED",
      calldata: preset.accountCalldata,
    });
    messages.length = 0;
    live.acceptReceipt({ ...receipt(launch(preset), "0x100"), finality_status: "PRE_CONFIRMED" });
    expect(world.native.receiptFailures).toBe(0);
    const diffs = messages.filter((message) => message.type === "diff");
    expect(diffs).toHaveLength(1);
    expect((diffs[0]!.set as { model: string }[]).filter(({ model }) => model === "ResourceRule")).toHaveLength(58);
    expect(world.fold.gameRows("ResourceRule", "1")).toHaveLength(0);
  });

  it("revalidates preimages when reusing pre-confirmed decodes, and rolls a later replay failure back", async () => {
    const world = setup();
    const preset = registration();
    const pending = receipt([preset.event]);
    const decoded = world.native.applyReceipt(world.fold.overlay(), pending, null, 0, preset.accountCalldata).decoded;
    const blocks = [
      {
        block_number: 10,
        timestamp: 1800,
        transactions: [{ receipt: pending, transaction: { type: "INVOKE", calldata: preset.accountCalldata } }],
      },
      {
        block_number: 11,
        timestamp: 1801,
        transactions: [{ receipt: receipt(launch(preset)), transaction: { type: "INVOKE" } }],
      },
    ];
    await world.native.replay({
      fold: world.fold,
      rpc: { getBlockWithReceipts: async (number) => blocks[Number(number) - 10]! },
      fromBlock: 10,
      toBlock: 11,
      preconfirmed: (candidate) => (candidate === pending ? { events: pending.events, decoded } : undefined),
    });
    expect(world.fold.checkpoint().preset_preimages).toHaveLength(1);
    expect(world.fold.gameRows("ResourceRule", "1")).toHaveLength(58);
    const fresh = setup();
    const before = fresh.fold.checkpoint();
    await expect(
      fresh.native.replay({
        fold: fresh.fold,
        rpc: {
          getBlockWithReceipts: async (number) => {
            if (number === 11) throw new Error("block unavailable");
            return blocks[0]!;
          },
        },
        fromBlock: 10,
        toBlock: 11,
      }),
    ).rejects.toThrow("block unavailable");
    expect(fresh.fold.checkpoint()).toEqual(before);
  });

  it("uses the preset map only when the chain explicitly records no map override", () => {
    const world = setup();
    const preset = registration();
    applyRegistration(world, preset);
    world.native.applyReceipt(world.fold, receipt(launch(preset, 1, 0, false)), 11, 0);
    const rules = world.fold.gameRows("SliceRules", "1")[0]!.value;
    expect(BigInt((rules.map_config as Record<string, string>).reward_resource_amount)).toBe(
      BigInt(preset.definition.rules.map_config.reward_resource_amount),
    );
  });

  it("refuses unproven execution status, trailing calldata and a mismatched game pin atomically", () => {
    const world = setup();
    const preset = registration();
    const before = world.fold.checkpoint();
    expect(() =>
      world.native.applyReceipt(
        world.fold,
        { ...receipt([preset.event]), execution_status: undefined },
        10,
        0,
        preset.accountCalldata,
      ),
    ).toThrow("successful execution");
    const trailing = [...preset.accountCalldata, "0"];
    expect(() => world.native.applyReceipt(world.fold, receipt([preset.event]), 10, 0, trailing)).toThrow(
      "Trailing account calldata",
    );
    expect(world.fold.checkpoint()).toEqual(before);
    applyRegistration(world, preset);
    const registered = world.fold.checkpoint();
    const invalid = launch(preset);
    invalid[invalid.length - 1] = rowEvent("GameRelease", ["1"], ["1", "999"]);
    expect(() => world.native.applyReceipt(world.fold, receipt(invalid), 11, 0)).toThrow(
      "differs from registered preset",
    );
    expect(world.fold.checkpoint()).toEqual(registered);
  });
});
