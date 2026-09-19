import {
  assertRegistrarAvailable,
  createRegistrarGame,
  resolveCreatedGameId,
  resolveBlitzRoster,
  findRegistrarGame,
} from "../registrar/calls";
import { afterAll, describe, expect, test, mock } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CallData, type Account, type RpcProvider } from "starknet";
import schema from "../../../../contracts/l3/world-native/schema/schema.json";
import madaraAddresses from "../../../../contracts/common/addresses/madara.json";
import { buildNativePreset } from "../config/native-preset";
import {
  buildNativePresetRegistration,
  registerNativePreset,
  buildNativeGameParams,
  loadNativePresetConfiguration,
} from "../registrar/native-preset";
import { nativeDomainAbi } from "../world/native/manifest";

mock.module("../shared/transaction", () => ({
  confirmedTransactionReceipt: async (provider: RpcProvider, transactionHash: string) =>
    provider.getTransactionReceipt(transactionHash),
}));

const abi = [...Object.values(schema.types), ...schema.domains.registry.entrypoints];
const codec = new CallData(abi);
const directory = mkdtempSync(join(tmpdir(), "native-preset-"));
const manifestPath = join(directory, "manifest.json");
writeFileSync(
  manifestPath,
  JSON.stringify({
    abis: abi,
    contracts: [{ address: "0x123", class_hash: "0x456" }],
    native: {
      domains: { registry: { address: "0x123" } },
      activeSchema: schema.identity,
      schemas: { [schema.identity]: schema },
    },
  }),
);
afterAll(() => rmSync(directory, { recursive: true }));

function configuration(preset: number) {
  const config = loadNativePresetConfiguration(preset === 1 ? "madara.eternum" : "madara.blitz", preset);
  return config;
}

describe("native immutable balance presets", () => {
  // Official reward ladders, retained from the pinned gameplay rules.
  test.each([
    {
      id: 2,
      expected: [
        [38, 150, 3500],
        [38, 300, 2500],
        [38, 600, 1500],
        [23, 500, 1500],
        [23, 1000, 500],
        [25, 500, 500],
      ],
    },
    {
      id: 3,
      expected: [
        [38, 100, 3000],
        [38, 250, 2000],
        [38, 500, 1500],
        [23, 250, 1500],
        [23, 500, 800],
        [25, 100, 600],
        [26, 1000, 200],
        [29, 1000, 200],
        [32, 1000, 200],
      ],
    },
  ])("preset $id preserves the official exploration reward ladder", ({ id, expected }) => {
    const definition = buildNativePreset(configuration(id));
    expect(definition.exploration.map(({ resource_type, amount, weight }) => [resource_type, amount, weight])).toEqual(
      expected,
    );
  });
  test("domain ABIs keep the two create_game call shapes separate", () => {
    const manifest = { native: { activeSchema: schema.identity, schemas: { [schema.identity]: schema } } };
    const registryAbi = nativeDomainAbi(manifest as never, "registry");
    const seasonAbi = nativeDomainAbi(manifest as never, "season");
    const names = (abi: typeof registryAbi) =>
      abi.find((entry) => entry.name === "create_game").inputs.map((input: { name: string }) => input.name);
    expect(names(registryAbi)).toEqual(["params", "definition"]);
    expect(names(seasonAbi)).toEqual(["game_id", "game", "rules"]);
  });
  test.each([1, 2, 3])("preset %i serializes all domains using the generated registrar ABI", (id) => {
    const config = configuration(id);
    const definition = buildNativePreset(config);
    const calldata = codec.compile("register_preset", { preset_id: id, definition });
    expect(calldata.length).toBeGreaterThan(1400);
    expect(calldata.every((value) => BigInt(value) >= 0n)).toBe(true);
    expect(definition.resources.resources.map((row) => row.resource_type)).toEqual(
      Array.from({ length: 58 }, (_, i) => i + 1),
    );
    expect(definition.resources.production).toHaveLength(58);
    expect(definition.structures.buildings).toHaveLength(40);
    expect(definition.settlement.realms.starting_troops).toHaveLength(17);
    expect(definition.settlement.villages.resource_pool).toHaveLength(22);
    expect(definition.economy.relics).toHaveLength(18);
    expect(definition.exploration).toHaveLength(id === 1 ? 23 : config.blitz.exploration.rewards.length);
  });

  test("mine presets preserve the fragment ladder and give Eternum rifts one quarter of regular-fast output", () => {
    const eternum = buildNativePreset(configuration(1));
    const fast = buildNativePreset(configuration(2));
    const rift = eternum.resources.mine_kinds[0].config;
    const fragment = eternum.resources.mine_kinds[1].config;
    expect(rift.production_rate).toBe(2_500000000n);
    expect(rift.production_rate * 4n).toBe(fast.resources.mine_kinds[0].config.production_rate);
    expect(rift.cap_min).toBe(36000_000000000n);
    expect(rift.cap_steps).toBe(1);
    expect(fragment).toMatchObject({ cap_min: 300000_000000000n, cap_steps: 10, production_rate: 1_500000000n });
    expect(eternum.resources.surface_mines).toEqual([
      { kind: 1, weight: 1 },
      { kind: 2, weight: 1 },
    ]);
    expect(fast.resources.surface_mines).toEqual([{ kind: 1, weight: 1 }]);
    expect(eternum.rules.bitcoin_mine_config.owner_cut_bps).toBe(2000);
  });

  test("native balances and mine ladders come only from the selected sheet", () => {
    const config = configuration(1);
    config.bitcoin = { prizePerPhase: 7, minimumLabor: 123, ownerCutBps: 1500 };
    config.mines!.kinds[1] = {
      resourceType: 38,
      buildingCategory: 39,
      productionRate: 9,
      capMinimum: 400,
      capSteps: 3,
    };
    config.mines!.surfacePool = [{ kind: 1, weight: 4 }];
    const definition = buildNativePreset(config);
    expect(definition.rules.bitcoin_mine_config).toEqual({
      enabled: true,
      prize_per_phase: 7_000000000n,
      min_labor_per_contribution: 123_000000000n,
      owner_cut_bps: 1500,
    });
    expect(definition.resources.mine_kinds[0].config).toEqual({
      resource_type: 38,
      building_category: 39,
      production_rate: 9_000000000n,
      cap_min: 400_000000000n,
      cap_steps: 3,
    });
    expect(definition.resources.surface_mines).toEqual([{ kind: 1, weight: 4 }]);
  });

  test("missing balances and malformed mine pools fail before registration", () => {
    const config = configuration(1);
    delete config.bitcoin;
    expect(() => buildNativePreset(config)).toThrow("Bitcoin balance config");
    config.bitcoin = configuration(1).bitcoin;
    delete config.mines;
    expect(() => buildNativePreset(config)).toThrow("Mine balance config");
    config.mines = configuration(1).mines;
    config.mines!.surfacePool = [{ kind: 99, weight: 1 }];
    expect(() => buildNativePreset(config)).toThrow("Invalid mine pool");
    config.mines!.surfacePool = [];
    expect(() => buildNativePreset(config)).toThrow("requires a pool");
  });

  test("explicit balance profiles must match the selected preset", () => {
    expect(() => loadNativePresetConfiguration("madara.blitz", 2, "official-90")).toThrow("does not match preset 2");
    expect(() => loadNativePresetConfiguration("madara.eternum", 1, "official-60")).toThrow("does not match preset 1");
    expect(loadNativePresetConfiguration("madara.blitz", 2, "official-60").mines!.kinds[1].productionRate).toBe(10);
  });

  test("large resource amounts retain bigint precision and missing balance entries fail", () => {
    const config = configuration(1);
    expect(buildNativePreset(config).economy.hyperstructures.initialize_shards).toBe(20_000_000_000000000n);
    delete (config.resources.resourceWeightsGrams as Partial<Record<number, number>>)[3];
    expect(() => buildNativePreset(config)).toThrow("Missing resource weight for 3");
  });

  test("building a changed preset cannot mutate the next definition's tables", () => {
    const first = buildNativePreset(configuration(1));
    first.settlement.villages.resource_pool[0].weight = 1;
    first.economy.relics[0].rate_bps = 1;
    first.settlement.realms.realm_resources.length = 0;
    const next = buildNativePreset(configuration(1));
    expect(next.settlement.villages.resource_pool[0].weight).toBe(19815);
    expect(next.economy.relics[0].rate_bps).toBe(5000);
    expect(next.settlement.realms.realm_resources).toHaveLength(9);
  });

  test("unchanged registration sends no transaction and a changed preimage fails", async () => {
    const registration = buildNativePresetRegistration(configuration(1), 1, manifestPath);
    let commitment = registration.commitment;
    const account = {
      getBlockNumber: async () => 10,
      getClassHashAt: async () => "0x456",
      callContract: async () => [commitment],
      execute: async () => {
        throw new Error("unexpected transaction");
      },
    } as unknown as Account;
    expect(await registerNativePreset(account, 1, registration)).toBeNull();
    commitment = "0x1";
    await expect(registerNativePreset(account, 1, registration)).rejects.toThrow("different immutable definition");
  });

  test("a stale manifest cannot register through a replaced registrar", async () => {
    const registration = buildNativePresetRegistration(configuration(2), 2, manifestPath);
    const account = {
      getBlockNumber: async () => 10,
      getClassHashAt: async () => "0x999",
      callContract: async () => {
        throw new Error("unexpected view");
      },
    } as unknown as Account;
    await expect(registerNativePreset(account, 2, registration)).rejects.toThrow("differs from manifest");
  });
});

test.each([1, 2])("native launch encodes preset %i and resolves its game from the season emitter", async (presetId) => {
  const config = configuration(presetId);
  const definition = buildNativePreset(config);
  const params = buildNativeGameParams(
    config,
    {
      gameName: "native-launch",
      presetId,
      startMainAt: 2000000000,
      durationSeconds: 3600,
      devModeOn: presetId === 1,
      singleRealmMode: presetId === 1,
      twoPlayerMode: presetId === 3,
      useMapOverride: false,
    },
    presetId === 1 ? [] : [{ owner: "0xabc", account: "0xdef" }],
  );
  const manifest = {
    world: { address: "0x456" },
    native: {
      domains: { registry: { address: "0x123" }, season: { address: "0x456" } },
      activeSchema: schema.identity,
      schemas: { [schema.identity]: schema },
    },
  };
  const layout = schema.domains.season.events.filter((event) => event.name === "RowSet").at(-1)!;
  const model = schema.models.find((model) => model.name === "GameRegistry")!;
  const event = { from_address: "0x456", keys: [...layout.prefix, "1", model.identity], data: ["1", "7", "1", "0"] };
  const receipt = { block_number: 42, execution_status: "SUCCEEDED", events: [event] };
  const execute = mock(async (_call: unknown, _details: unknown) => ({ transaction_hash: "0x789" }));
  const account = { execute, getTransactionReceipt: async () => receipt } as unknown as Account;
  assertRegistrarAvailable(manifest as never);
  const created = await createRegistrarGame(account, params, manifest as never, undefined, definition);
  expect(created.gameId).toBe(7);
  expect(created.transactionHash).toBe("0x789");
  expect(execute.mock.calls[0][0]).toEqual({
    contractAddress: "0x123",
    entrypoint: "create_game",
    calldata: codec.compile("create_game", { params, definition }),
  });
  expect(params.roster).toEqual(presetId === 1 ? [] : [{ owner: "0xabc", account: "0xdef" }]);
  expect(resolveCreatedGameId({ events: [{ ...event, from_address: "0x999" }] }, manifest as never)).toBeUndefined();
  for (const layout of schema.domains.season.events.filter((event) => event.name === "RowSet")) {
    expect(
      resolveCreatedGameId(
        { events: [{ ...event, keys: [...layout.prefix, "1", model.identity] }] },
        manifest as never,
      ),
    ).toBe(7);
  }
  await expect(createRegistrarGame(account, params, manifest as never)).rejects.toThrow("immutable preset definition");
});

test("every native preset selects its declared game and balance profile", () => {
  expect(loadNativePresetConfiguration("madara.eternum", 1).blitz.mode.on).toBe(false);
  expect(loadNativePresetConfiguration("madara.blitz", 2).blitz.exploration.rewardProfileId).toBe("official-60");
  expect(loadNativePresetConfiguration("madara.blitz", 3).blitz.exploration.rewardProfileId).toBe("official-90");
  expect(() => loadNativePresetConfiguration("madara.blitz", 999)).toThrow("No native preset");
  expect(() => loadNativePresetConfiguration("madara.eternum", 2)).toThrow("No native preset");
});

test("Eternum registers its configured bridge tokens and Blitz has no bridge", () => {
  const preset = buildNativePreset(configuration(1));
  expect(preset.economy.withdrawals.unwrap()?.tokens).toEqual(
    [
      ...Object.values(madaraAddresses.resources).map(([resource_type, token]) => ({
        resource_type: Number(resource_type),
        token: String(token),
      })),
      { resource_type: 37, token: madaraAddresses.lords },
    ].sort((a, b) => Number(a.resource_type) - Number(b.resource_type)),
  );
  expect(preset.faith_reward_token).toBe(madaraAddresses.lords);
  expect(buildNativePreset(configuration(2)).economy.withdrawals.isNone()).toBe(true);
  for (const [mutation, error] of [
    [
      (config) => {
        delete config.faith;
      },
      "Native faith config is required",
    ],
    [
      (config) => {
        config.faith!.reward_token = "0x0";
      },
      "reward token",
    ],
    [
      (config) => {
        delete config.artificer;
      },
      "Native research cost",
    ],
    [
      (config) => {
        delete (config.setup!.addresses as { resources?: unknown }).resources;
      },
      "Eternum bridge resource tokens",
    ],
    [
      (config) => {
        config.setup!.addresses.lords = "0x0";
      },
      "Missing bridge token for resource 37",
    ],
  ] as Array<[(config: ReturnType<typeof configuration>) => void, string]>) {
    const config = configuration(1);
    mutation(config);
    expect(() => buildNativePreset(config)).toThrow(error);
  }
});

describe("fixed Regular Blitz rosters", () => {
  const target = {
    native: {
      domains: { registry: { address: "0x123" }, season: { address: "0x456" } },
      activeSchema: schema.identity,
      schemas: { [schema.identity]: schema },
    },
  };
  const input = {
    gameName: "free-slot-1",
    presetId: 2,
    startMainAt: 2000000000,
    durationSeconds: 3600,
    devModeOn: false,
    singleRealmMode: false,
    twoPlayerMode: false,
    useMapOverride: false,
  };
  test("creation requires the frozen roster and never enables Duel or dev mode", () => {
    const config = configuration(2);
    const players = [{ owner: "0xabc", account: "0xdef" }];
    expect(() => buildNativeGameParams(config, input)).toThrow("fixed roster");
    expect(() => buildNativeGameParams(config, input, Array(25).fill(players[0]))).toThrow("fixed roster");
    expect(() => buildNativeGameParams(config, { ...input, twoPlayerMode: true }, players)).toThrow("Regular Blitz");
    expect(() => buildNativeGameParams(config, { ...input, devModeOn: true }, players)).toThrow("development mode");
    expect(buildNativeGameParams(config, input, players).roster).toEqual(players);
  });
  test("binding resolution uses one confirmed block and preserves registration order", async () => {
    const callContract = mock(
      async ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }, block: number) => {
        expect(block).toBe(42);
        if (entrypoint === "authentication") return ["0x10", "0x20", "0x30"];
        if (entrypoint === "account_of") return [BigInt(calldata[0]) === 1n ? "0x101" : "0x102"];
        if (entrypoint === "owner_of") return [BigInt(calldata[0]) === 0x101n ? "0x1" : "0x2"];
        throw new Error("Unexpected view");
      },
    );
    const provider = { getBlockNumber: async () => 42, callContract } as unknown as RpcProvider;
    expect(await resolveBlitzRoster(provider, ["0x02", "0x1"], target as never)).toEqual([
      { owner: "0x2", account: "0x102" },
      { owner: "0x1", account: "0x101" },
    ]);
    expect(callContract).toHaveBeenCalledTimes(5);
    await expect(resolveBlitzRoster(provider, ["0x01", "0x1"], target as never)).rejects.toThrow("Duplicate");
    expect(callContract).toHaveBeenCalledTimes(5);
  });
  test.each(["0x0", "0x999"])("an unbound or mismatched account %s fails loudly", async (bound) => {
    const provider = {
      getBlockNumber: async () => 42,
      callContract: async ({ entrypoint }: { entrypoint: string }) => {
        if (entrypoint === "authentication") return ["0x10", "0x20", "0x30"];
        if (entrypoint === "account_of") return [bound];
        return ["0x777"];
      },
    } as unknown as RpcProvider;
    await expect(resolveBlitzRoster(provider, ["0x1"], target as never)).rejects.toThrow();
  });
  test("creation recovery reads the registrar without waiting for Herald", async () => {
    const callContract = mock(async () => ["0x7"]);
    const provider = { callContract } as unknown as RpcProvider;
    expect(await findRegistrarGame(provider, "free-slot-1", target as never)).toEqual({ gameId: 7 });
    expect(callContract.mock.calls).toHaveLength(1);
  });
});
