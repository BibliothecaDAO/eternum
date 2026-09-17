import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CallData, type Account } from "starknet";
import schema from "../../../../contracts/l3/world-native/schema/schema.json";
import { applyBlitzBalanceProfile } from "../../../source/blitz";
import { loadEnvironmentConfiguration } from "../config/config-loader";
import { buildNativePreset } from "../config/native-preset";
import { buildNativePresetRegistration, registerNativePreset } from "../registrar/native-preset";
import { nativeDomainAbi } from "../world/native/manifest";

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
  return preset === 1
    ? loadEnvironmentConfiguration("madara.eternum")
    : applyBlitzBalanceProfile(
        loadEnvironmentConfiguration("madara.blitz"),
        preset === 2 ? "official-60" : "official-90",
      );
}

describe("native immutable balance presets", () => {
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
    expect(eternum.resources.ethereal_mines).toEqual([]);
    expect(eternum.rules.bitcoin_mine_config.owner_cut_bps).toBe(2000);
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
