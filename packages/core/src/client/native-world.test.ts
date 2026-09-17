import { encodeNativeCommand } from "@bibliothecadao/provider";
import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "./native-fact-store";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { hash, type AccountInterface } from "starknet";
import bindingsJson from "../../../../contracts/l3/world-native/schema/bindings.json";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-1.json";
import rowFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { nativeSubmission } from "./native-submission";
import type { SignedNativeIntent } from "@bibliothecadao/provider";

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
  write("ActionNonce", [1n, 0x111n], { game_id: 1, actor: "0x111", next_nonce: "0" });
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

  it("signs an ABI command with the synchronized nonce and published framing", async () => {
    const { store, write } = await fixture();
    write("ActionNonce", [1n, 0x111n], { game_id: 1, actor: "0x111", next_nonce: "3" });
    write("SliceRules", [1n], { ...preset.rules, game_id: 1 });
    const submitIntent = vi.fn(async (_action: SignedNativeIntent) => ({ transaction_hash: "0x99" }));
    const signIntent = vi.fn(async (_actor: AccountInterface, _digest: string) => ({ r: 1n, s: 2n, publicKey: 3n }));
    const send = nativeSubmission({ bindings, chainId: "0x1", signIntent, submitIntent }, store, 1, "0x101");
    const call = {
      contractAddress: "0x101",
      entrypoint: "Explore",
      calldata: [
        "1",
        ...encodeNativeCommand(bindings.commandAbi, { kind: "Explore", value: { explorer_id: 7, direction: 2 } }),
      ],
    };
    await send({ address: "0x111" } as AccountInterface, call);
    const encoded = submitIntent.mock.calls[0][0].intent.map(BigInt);
    expect(encoded[6]).toBe(3n);
    expect(encoded.slice(12)).toEqual([3n, 1n, 7n, 2n]);
    expect(signIntent.mock.calls[0][1]).toBe(hash.computePoseidonHashOnElements(submitIntent.mock.calls[0][0].intent));
    expect(store.require("ActionNonce", { game_id: 1, actor: 0x111n }).next_nonce).toBe(3n);
    await expect(send({ address: "0x111" } as AccountInterface, { ...call, entrypoint: "Move" })).rejects.toThrow(
      "discriminant mismatch",
    );
    await expect(
      send({ address: "0x111" } as AccountInterface, { ...call, calldata: ["2", ...call.calldata.slice(1)] }),
    ).rejects.toThrow("game mismatch");
    expect(signIntent).toHaveBeenCalledOnce();
  });
  it("never signs with an unknown nonce and accepts an explicit initial row from Herald", async () => {
    const { store, write } = await fixture();
    write("SliceRules", [1n], { ...preset.rules, game_id: 1 });
    const actor = { address: "0x222" } as AccountInterface;
    const signIntent = vi.fn(async (_actor: AccountInterface, _digest: string) => ({ r: 1n, s: 2n, publicKey: 3n }));
    const submitIntent = vi.fn(async () => ({ transaction_hash: "0x99" }));
    const connection = { bindings, chainId: "0x1", signIntent, submitIntent };
    const call = {
      contractAddress: "0x101",
      entrypoint: "CloseBitcoinPhase",
      calldata: ["1", ...encodeNativeCommand(bindings.commandAbi, { kind: "CloseBitcoinPhase", value: 42n })],
    };
    await expect(nativeSubmission(connection, store, 1, "0x101")(actor, call)).rejects.toThrow("not synchronized");
    expect(signIntent).not.toHaveBeenCalled();
    const prepare = vi.fn(async () => {
      write("ActionNonce", [1n, 0x222n], { game_id: 1, actor: "0x222", next_nonce: "0" });
    });
    await nativeSubmission(connection, store, 1, "0x101", prepare)(actor, call);
    expect(prepare).toHaveBeenCalledWith("0x222");
    expect(signIntent).toHaveBeenCalledOnce();
  });
});
