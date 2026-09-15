import { describe, expect, it, vi } from "vitest";
import { setup } from "@bibliothecadao/dojo";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { getComponentValue, type Entity } from "@dojoengine/recs";
import { CallData, shortString, hash, type AccountInterface, type Call } from "starknet";
import bindingsJson from "../../../../contracts/l3/world-native/schema/bindings.json";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-1.json";
import rowFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { createRecsGameSyncStore } from "./recs-game-sync-store";
import { nativeConfiguration } from "./native-config";
import { nativeSubmission } from "./native-submission";

const bindings = bindingsJson as unknown as NativeWorldBindings;
async function fixture() {
  const client = await setup(
    {
      rpcUrl: "http://127.0.0.1:1",
      manifest: { world: { address: "0x101", abi: bindings.commandAbi }, contracts: [] } as never,
    },
    { namespace: "s2", gameId: 1, useBurner: false, vrfProviderAddress: "0x0", nativeBindings: bindings },
  );
  const store = createRecsGameSyncStore(
    client,
    bindings.models.map((model) => model.name),
  );
  const write = (model: string, keys: bigint[], value: Record<string, unknown>) =>
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: hash.computePoseidonHashOnElements(keys),
            models: { [model]: value },
          },
        ],
      },
    ]);
  return { client, store, write };
}

describe("native bindings in the shared game client", () => {
  it("folds the generated explorer fixture into typed RECS and deletes it", async () => {
    const { client, store, write } = await fixture();
    write("ExplorerTroops", [1n, 7n], { ...rowFixture.expected.key, ...rowFixture.expected.value });
    const entity = hash.computePoseidonHashOnElements([1, 7]) as Entity;
    const explorer = getComponentValue(client.components.ExplorerTroops, entity)!;
    expect(explorer.game_id).toBe(1);
    expect(explorer.explorer_id).toBe(7);
    expect(explorer.troops.category).toBe("Knight");
    expect(typeof explorer.troops.count).toBe("bigint");
    store.applyEntityOperations([{ type: "remove-components", entityId: entity, models: ["ExplorerTroops"] }]);
    expect(getComponentValue(client.components.ExplorerTroops, entity)).toBeUndefined();
  });
  it("reads config from RECS and rejects missing or unported configuration", async () => {
    const { client, write } = await fixture();
    const config = nativeConfiguration(client.components, 1);
    expect(() => config.rules()).toThrow("not synchronized");
    write("SliceRules", [1n], { ...preset.rules, game_id: "1", map_center_offset: "20" });
    write("ResourceRule", [1n, 24n], {
      ...preset.resources.find((resource) => resource.resource_type === 24)!,
      game_id: "1",
      unit_weight: "2500",
    });
    expect(config.rules().map_center_offset).toBe(20);
    expect(config.weight(24)).toBe(2.5);
    expect(() => config.rules().bank_config).toThrow("Unsupported");
    expect(() => config.weight(25)).toThrow("not synchronized");
  });
  it("signs the RECS nonce and rejects unsupported actions before submission", async () => {
    const { client, write } = await fixture();
    write("ActionNonce", [1n, 0x111n], { game_id: "1", actor: "0x111", next_nonce: "3" });
    write("SliceRules", [1n], { ...preset.rules, game_id: "1", map_center_offset: "20" });
    write("DomainState", [0x101n], {
      address: "0x101",
      authority: "0x999",
      peers: { season: "0x101", map: "0x102", structures: "0x103", troops: "0x104" },
      active: true,
    });
    write("ExecutionHead", [0x101n], {
      address: "0x101",
      order: 6,
      binding: "123",
      state: "456",
      timestamp: 99,
      root: "0",
    });
    const submit = vi.fn(async (_call: Call) => ({ transaction_hash: "0x99" }));
    const signIntent = vi.fn(async () => ({ r: 1n, s: 2n }));
    const send = nativeSubmission(
      {
        bindings,
        chainId: "0x1",
        executionContext: () => ({
          rawRoot: 42n,
          timestamp: 100,
          authorityEpoch: 1,
          acceptedPublicKey: "0x1",
          l2Gas: 1200000000n,
        }),
        submit,
        signIntent,
      },
      client.components,
      1,
      "0x101",
    );
    const actor = { address: "0x111" } as AccountInterface;
    await send(actor, { contractAddress: "0x101", entrypoint: "explorer_create", calldata: [1, 9, 0, 0, 100, 0] });
    expect(submit).toHaveBeenCalledOnce();
    expect(signIntent).toHaveBeenCalledOnce();
    const calldata = submit.mock.calls[0][0].calldata as string[];
    expect(calldata.slice(0, 5)).toEqual(["1", "257", "1", "273", "3"]);
    expect(calldata[9]).toBe("7");
    const codec = new CallData(bindings.commandAbi);
    const originalRules = codec.compile("rules_commitment", { rules: preset.rules });
    const storedRules = codec.compile("rules_commitment", { rules: nativeConfiguration(client.components, 1).rules() });
    expect(storedRules).toEqual(originalRules);
    expect(calldata[6]).toBe(
      BigInt(
        hash.computePoseidonHashOnElements([shortString.encodeShortString("ETERNUM_RULES"), 1, ...originalRules]),
      ).toString(),
    );
    await expect(
      send(actor, { contractAddress: "0x101", entrypoint: "explorer_extract_reward", calldata: [1, 7] }),
    ).rejects.toThrow("Unsupported");
    expect(submit).toHaveBeenCalledOnce();
    for (const [entrypoint, variant] of [
      ["transfer_structure_ownership", "6"],
      ["transfer_agent_ownership", "7"],
    ]) {
      await send(actor, { contractAddress: "0x101", entrypoint, calldata: [1, 9, "0x456"] });
      const encoded = submit.mock.calls.at(-1)![0].calldata as string[];
      expect(encoded.slice(10, 14)).toEqual(["3", variant, "9", "1110"]);
      expect(encoded[4]).toBe("3");
    }
  });
});
