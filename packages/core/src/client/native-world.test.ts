import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "./native-fact-store";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { CallData, shortString, hash, type AccountInterface } from "starknet";
import bindingsJson from "../../../../contracts/l3/world-native/schema/bindings.json";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-1.json";
import rowFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { nativeSubmission, type SignedNativeIntent } from "./native-submission";

const bindings = bindingsJson as unknown as NativeWorldBindings;
async function fixture() {
  const store = new NativeFactStore();
  const client = { store };
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
  it("folds the generated explorer fixture into typed facts and deletes it", async () => {
    const { client, store, write } = await fixture();
    write("ExplorerTroops", [1n, 7n], { ...rowFixture.expected.key, ...rowFixture.expected.value });
    const entity = hash.computePoseidonHashOnElements([1, 7]);
    const explorer = store.get("ExplorerTroops", { game_id: 1, explorer_id: 7 })!;
    expect(explorer.game_id).toBe(1);
    expect(explorer.explorer_id).toBe(7);
    expect(explorer.troops.category).toBe("Knight");
    expect(typeof explorer.troops.count).toBe("bigint");
    store.applyEntityOperations([{ type: "remove-components", entityId: entity, models: ["ExplorerTroops"] }]);
    expect(store.get("ExplorerTroops", { game_id: 1, explorer_id: 7 })).toBeUndefined();
  });
  it("reads immutable config from native facts and rejects missing configuration", async () => {
    const { store, write } = await fixture();
    expect(() => store.require("SliceRules", { game_id: 1 })).toThrow("not synchronized");
    write("SliceRules", [1n], { ...preset.rules, game_id: "1", map_center_offset: "20" });
    expect(store.require("SliceRules", { game_id: 1 }).map_center_offset).toBe(20);
    expect(() => store.require("ResourceRule", { game_id: 1, resource_type: 25 })).toThrow("not synchronized");
  });
  it.each([
    ["contribute_labor", [9, 100], [34, 9, 100]],
    ["close_bitcoin_phase", [42], [35, 42]],
    ["bind_bitcoin_phase", [42], [36, 42]],
    ["claim_phase_reward", [42, 2, 7, 8], [37, 42, 2, 7, 8]],
    ["settle_season", [65, 273, 1], [14, 65, 273, 1]],
    ["settle_season", [65, 273, 0, 8000], [14, 65, 273, 0, 8000]],
    ["settle_village", [273, 7, 9], [15, 273, 7, 9]],
    ["settle_blitz", [65, 273, 0, 0, 0, 1], [11, 65, 273, 0, 0, 0, 1]],
    ["settle_blitz", [65, 273, 777, 42, 1, 1, 273, 99, 0], [11, 65, 273, 777, 42, 1, 1, 273, 99, 0]],
    ["guard_add", [9, 2, 2, 1, 100], [77, 0, 9, 2, 2, 1, 100]],
    ["guard_delete", [9, 2], [77, 1, 9, 2]],
    ["explorer_add", [7, 100, 3], [77, 2, 7, 100]],
    ["explorer_delete", [7], [77, 3, 7]],
    ["explorer_explorer_swap", [7, 8, 3, 100], [77, 4, 0, 7, 0, 8, 100]],
    ["explorer_guard_swap", [7, 9, 3, 2, 100], [77, 4, 0, 7, 1, 9, 2, 100]],
    ["guard_explorer_swap", [9, 2, 7, 3, 100], [77, 4, 1, 9, 2, 0, 7, 100]],
    ["attack_explorer_vs_explorer", [7, 8, 2, 1, 100, 2, 200], [3, 7, 8, 2, 1, 100, 2, 200]],
    ["attack_explorer_vs_guard", [7, 9], [38, 7, 9]],
    ["attack_guard_vs_explorer", [9, 2, 7], [78, 9, 2, 7]],
    ["raid_explorer_vs_guard", [7, 9, 3, 1, 1, 100], [79, 7, 9, 1, 1, 100]],
    ["explorer_extract_reward", [7], [54, 7]],
    ["create_order", [9, 0, 1, 2, 100, 5, 200, 999], [39, 9, 0, 1, 2, 100, 200, 5, 999]],
    ["accept_order", [9, 10, 2], [40, 10, 9, 2]],
    ["cancel_order", [10], [41, 10]],
    ["buy", [11, 9, 2, 100], [43, 11, 9, 2, 100]],
    ["sell", [11, 9, 2, 100], [44, 11, 9, 2, 100]],
    ["add", [11, 9, 2, 100, 200], [45, 11, 9, 2, 100, 200]],
    ["remove", [11, 9, 2, 100], [46, 11, 9, 2, 100]],
    ["initialize", [12], [47, 12]],
    ["allocate_shares", [12, 2, 273, 6000, 274, 4000], [49, 12, 2, 273, 6000, 274, 4000]],
    ["update_construction_access", [12, 2], [50, 12, 2]],
    ["open_chest", [7, 1, 10, 11], [52, 7, 1, 10, 11]],
    ["apply_relic", [7, 39, 0], [53, 7, 39, 0]],
    ["checkpoint_hyperstructures", [2, 7, 8], [51, 2, 7, 8]],
    ["rank_players", [123, 2, 2, 273, 274], [67, 123, 2, 2, 273, 274]],
    ["season_close", [], [55]],
    ["pledge_faith", [9, 12], [56, 9, 12]],
    ["remove_faith", [9], [57, 9]],
    ["update_wonder_ownership", [12], [58, 12]],
    ["update_structure_ownership", [9], [59, 9]],
    ["burn_research_for_relic", [9], [69, 9]],
    ["leave_guild", [], [72]],
    ["remove_member", [273], [74, 273]],
  ])("encodes %s as a single signed native command", async (entrypoint, fields, expected) => {
    const { store, write } = await fixture();
    write("SliceRules", [1n], { ...preset.rules, game_id: 1 });
    const submitIntent = vi.fn(async (_action: SignedNativeIntent) => ({ transaction_hash: "0x99" }));
    const signIntent = vi.fn(async () => ({ r: 1n, s: 2n }));
    const send = nativeSubmission({ bindings, chainId: "0x1", signIntent, submitIntent }, store, 1, "0x101");
    await send({ address: "0x111" } as AccountInterface, {
      contractAddress: "0x101",
      entrypoint,
      calldata: [1, ...fields],
    });
    expect(signIntent).toHaveBeenCalledOnce();
    expect(submitIntent).toHaveBeenCalledOnce();
    const encoded = submitIntent.mock.calls[0][0].intent.map(BigInt);
    expect(encoded.slice(12)).toEqual([BigInt(expected.length), ...expected.map(BigInt)]);
    expect(encoded[7]).toBe(
      BigInt(hash.computePoseidonHashOnElements([shortString.encodeShortString("ETERNUM_COMMAND"), 1, ...expected])),
    );
  });
  it("rejects malformed combat loot and troop enums before signing", async () => {
    const { store, write } = await fixture();
    write("SliceRules", [1n], { ...preset.rules, game_id: 1 });
    const submitIntent = vi.fn();
    const signIntent = vi.fn();
    const send = nativeSubmission({ bindings, chainId: "0x1", signIntent, submitIntent }, store, 1, "0x101");
    for (const [entrypoint, fields] of [
      ["attack_explorer_vs_explorer", [7, 8, 1, 1]],
      ["raid_explorer_vs_guard", [7, 9, 3, 0, 1]],
      ["guard_add", [9, 2, 3, 1, 100]],
      ["guard_add", [9, 2, 1, -1, 100]],
    ] as const) {
      await expect(
        send({ address: "0x111" } as AccountInterface, {
          contractAddress: "0x101",
          entrypoint,
          calldata: [1, ...fields],
        }),
      ).rejects.toThrow("Invalid native");
    }
    expect(signIntent).not.toHaveBeenCalled();
    expect(submitIntent).not.toHaveBeenCalled();
  });
  it("signs the native nonce and rejects unsupported actions before submission", async () => {
    const { client, write } = await fixture();
    write("ActionNonce", [1n, 0x111n], { game_id: "1", actor: "0x111", next_nonce: "3" });
    write("SliceRules", [1n], { ...preset.rules, game_id: "1", map_center_offset: "20" });
    write("DomainState", [0x101n], {
      address: "0x101",
      authority: "0x999",
      peers: {
        season: "0x101",
        map: "0x102",
        structures: "0x103",
        troops: "0x104",
        settlement: "0x105",
        resources: "0x106",
        economy: "0x107",
        prizes: "0x108",
        registry: "0x109",
        combat: "0x10a",
        bridge: "0x10b",
      },
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
    const submit = vi.fn(async (_action: SignedNativeIntent) => ({ transaction_hash: "0x99" }));
    const signIntent = vi.fn(async () => ({ r: 1n, s: 2n }));
    const send = nativeSubmission(
      {
        bindings,
        chainId: "0x1",
        submitIntent: submit,
        signIntent,
      },
      client.store,
      1,
      "0x101",
    );
    const actor = { address: "0x111" } as AccountInterface;
    await send(actor, { contractAddress: "0x101", entrypoint: "explorer_create", calldata: [1, 9, 0, 0, 100, 0] });
    expect(submit).toHaveBeenCalledOnce();
    expect(Object.keys(submit.mock.calls[0][0]).sort()).toEqual(["intent", "r", "s"]);
    expect(signIntent).toHaveBeenCalledWith(actor, hash.computePoseidonHashOnElements(submit.mock.calls[0][0].intent));
    const calldata = submit.mock.calls[0][0].intent.map((felt) => BigInt(felt).toString());
    expect(calldata.slice(2, 7)).toEqual(["1", "257", "1", "273", "3"]);
    expect(calldata[9]).toBe("0");
    expect(Number(calldata[10])).toBeGreaterThan(Math.floor(Date.now() / 1_000));
    expect(calldata[11]).toBe("18446744073709551615");
    const codec = new CallData(bindings.commandAbi);
    const originalRules = codec.compile("rules_commitment", { rules: preset.rules });
    const storedRules = codec.compile("rules_commitment", {
      rules: client.store.require("SliceRules", { game_id: 1 }),
    });
    expect(storedRules).toEqual(originalRules);
    expect(calldata[8]).toBe(
      BigInt(
        hash.computePoseidonHashOnElements([shortString.encodeShortString("ETERNUM_RULES"), 1, ...originalRules]),
      ).toString(),
    );
    await expect(
      send(actor, { contractAddress: "0x101", entrypoint: "unknown_action", calldata: [1, 7] }),
    ).rejects.toThrow("Unsupported");
    expect(submit).toHaveBeenCalledOnce();
    const structure = {
      base: {
        troop_explorer_count: 0,
        troop_max_guard_count: 0,
        troop_max_explorer_count: 0,
        created_at: 0,
        category: 1,
        coord_x: 0,
        coord_y: 0,
        level: 0,
        starting_troops_granted: false,
        alt: false,
      },
      troop_explorers: [],
      resources_packed: "0",
      metadata: { realm_id: 0, order: 0, has_wonder: false, village_realm: 0, mine_kind: 0 },
    };
    write("Structure", [1n, 12n], { ...structure, game_id: 1, entity_id: 12, owner: "0x111" });
    write("Structure", [1n, 9n], { ...structure, game_id: 1, entity_id: 9, owner: "0x111" });
    write("Structure", [2n, 1n], { ...structure, game_id: 2, entity_id: 1, owner: "0x111" });
    write("Structure", [1n, 2n], { ...structure, game_id: 1, entity_id: 2, owner: "0x456" });
    await send(actor, { contractAddress: "0x101", entrypoint: "set_address_name", calldata: [1, "0xabc"] });
    expect(
      submit.mock.calls
        .at(-1)![0]
        .intent.map((felt) => BigInt(felt).toString())
        .slice(12, 16),
    ).toEqual(["3", "8", "9", "2748"]);
    await expect(
      send({ address: "0x789" } as AccountInterface, {
        contractAddress: "0x101",
        entrypoint: "set_address_name",
        calldata: [1, "0xabc"],
      }),
    ).rejects.toThrow("owned structure");
    await send(actor, { contractAddress: "0x101", entrypoint: "level_up", calldata: [1, 9] });
    expect(
      submit.mock.calls
        .at(-1)![0]
        .intent.map((felt) => BigInt(felt).toString())
        .slice(12, 15),
    ).toEqual(["2", "9", "9"]);
    for (const [entrypoint, variant, fields] of [
      ["approve", "17", [9, 12]],
      ["structure_burn", "18", [9]],
      ["troop_burn", "20", [7]],
      ["troop_troop_adjacent_transfer", "21", [7, 8]],
      ["structure_troop_adjacent_transfer", "22", [9, 7]],
      ["send", "24", [9, 12]],
      ["pickup", "25", [12, 9]],
      ["troop_structure_adjacent_transfer", "26", [7, 9]],
    ] as const) {
      await send(actor, {
        contractAddress: "0x101",
        entrypoint,
        calldata: [1, ...fields, 2, 1, "340282366920938463463374607431768211455", 38, 0],
      });
      const encoded = submit.mock.calls.at(-1)![0].intent.map((felt) => BigInt(felt).toString());
      const endpoints = entrypoint === "pickup" ? [...fields].reverse() : fields;
      const expected = [
        variant,
        ...endpoints.map(String),
        "2",
        "1",
        "340282366920938463463374607431768211455",
        "38",
        "0",
      ];
      expect(encoded.slice(12, 13 + expected.length)).toEqual([String(expected.length), ...expected]);
      expect(encoded[7]).toBe(
        BigInt(
          hash.computePoseidonHashOnElements([shortString.encodeShortString("ETERNUM_COMMAND"), 1, ...expected]),
        ).toString(),
      );
    }
    await send(actor, { contractAddress: "0x101", entrypoint: "arrivals_offload", calldata: [1, 9, 4, 48, 255] });
    expect(
      submit.mock.calls
        .at(-1)![0]
        .intent.map((felt) => BigInt(felt).toString())
        .slice(12, 18),
    ).toEqual(["5", "23", "9", "4", "48", "255"]);
    await send(actor, { contractAddress: "0x101", entrypoint: "structure_regularize_weight", calldata: [1, 2, 9, 12] });
    expect(
      submit.mock.calls
        .at(-1)![0]
        .intent.map((felt) => BigInt(felt).toString())
        .slice(12, 17),
    ).toEqual(["4", "19", "2", "9", "12"]);
    for (const [entrypoint, variant, amountsFirst] of [
      ["burn_resource_for_labor_production", "27", false],
      ["burn_labor_for_resource_production", "28", true],
      ["burn_resource_for_resource_production", "29", false],
    ] as const) {
      const types = [26, 34];
      const amounts = [1, "340282366920938463463374607431768211455"];
      await send(actor, {
        contractAddress: "0x101",
        entrypoint,
        calldata: [1, 9, 2, ...(amountsFirst ? amounts : types), 2, ...(amountsFirst ? types : amounts)],
      });
      const encoded = submit.mock.calls.at(-1)![0].intent.map((felt) => BigInt(felt).toString());
      const expected = [variant, "9", "2", ...types.map(String), "2", ...amounts.map(String)];
      expect(encoded.slice(12, 13 + expected.length)).toEqual([String(expected.length), ...expected]);
      expect(encoded[7]).toBe(
        BigInt(
          hash.computePoseidonHashOnElements([shortString.encodeShortString("ETERNUM_COMMAND"), 1, ...expected]),
        ).toString(),
      );
      const before = submit.mock.calls.length;
      for (const fields of [[9], [9, -1], [9, 1, 26], [9, 1, 26, 2, 1], [9, 0, 0, 7]]) {
        await expect(send(actor, { contractAddress: "0x101", entrypoint, calldata: [1, ...fields] })).rejects.toThrow(
          "production list length",
        );
      }
      expect(submit).toHaveBeenCalledTimes(before);
    }
    for (const simple of [false, true]) {
      await send(actor, {
        contractAddress: "0x101",
        entrypoint: "create_building",
        calldata: [1, 9, 2, 0, 1, 37, simple ? "0x1" : "0x0"],
      });
      expect(
        submit.mock.calls
          .at(-1)![0]
          .intent.map((felt) => BigInt(felt).toString())
          .slice(12, 20),
      ).toEqual(["7", "30", "9", "2", "0", "1", "37", simple ? "1" : "0"]);
    }
    for (const [entrypoint, variant] of [
      ["destroy_building", "31"],
      ["pause_building_production", "32"],
      ["resume_building_production", "33"],
    ] as const) {
      await send(actor, { contractAddress: "0x101", entrypoint, calldata: [1, 9, "0x0", 11, 10] });
      expect(
        submit.mock.calls
          .at(-1)![0]
          .intent.map((felt) => BigInt(felt).toString())
          .slice(12, 18),
      ).toEqual(["5", variant, "9", "0", "11", "10"]);
    }
    const beforeBuildings = submit.mock.calls.length;
    await expect(
      send(actor, { contractAddress: "0x101", entrypoint: "create_building", calldata: [1, 9, 2, 0, 37, 1] }),
    ).rejects.toThrow("Unsupported native action");
    await expect(
      send(actor, { contractAddress: "0x101", entrypoint: "create_building", calldata: [1, 9, 1, 0, 37, 2] }),
    ).rejects.toThrow("Invalid native boolean");
    await expect(
      send(actor, { contractAddress: "0x101", entrypoint: "destroy_building", calldata: [1, 9, 2, 11, 10] }),
    ).rejects.toThrow("Invalid native boolean");
    expect(submit).toHaveBeenCalledTimes(beforeBuildings);
    const submitted = submit.mock.calls.length;
    for (const malformed of [
      [1, 9],
      [1, 9, -1],
      [1, 9, 1, 1],
      [1, 9, 0, 1, 2],
    ]) {
      await expect(
        send(actor, { contractAddress: "0x101", entrypoint: "structure_burn", calldata: malformed }),
      ).rejects.toThrow("resource list length");
    }
    expect(submit).toHaveBeenCalledTimes(submitted);
    for (const [entrypoint, variant] of [
      ["transfer_structure_ownership", "6"],
      ["transfer_agent_ownership", "7"],
    ]) {
      await send(actor, { contractAddress: "0x101", entrypoint, calldata: [1, 9, "0x456"] });
      const encoded = submit.mock.calls.at(-1)![0].intent.map((felt) => BigInt(felt).toString());
      expect(encoded.slice(12, 16)).toEqual(["3", variant, "9", "1110"]);
      expect(encoded[6]).toBe("3");
    }
  });
});
