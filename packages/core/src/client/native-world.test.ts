import { encodeNativeCommand } from "@bibliothecadao/provider";
import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "./native-fact-store";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { hash, type AccountInterface } from "starknet";
import bindingsJson from "../../../../contracts/l3/world-native/schema/bindings.json";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-3.json";
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
  it("signs an ABI command with the synchronized nonce and published framing", async () => {
    const { store, write } = await fixture();
    write("ActionNonce", [1n, 0x111n], { game_id: 1, actor: "0x111", next_nonce: "3" });
    write("SliceRules", [1n], { ...preset.rules, game_id: 1 });
    const submitIntent = vi.fn(async (_action: SignedNativeIntent) => ({ transaction_hash: "0x99", order: 7n }));
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
    expect(await send({ address: "0x111" } as AccountInterface, call)).toEqual({
      transaction_hash: "0x99",
      ticket: { gameId: "1", actor: "0x111", nonce: "3", order: "7" },
    });
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
    const submitIntent = vi.fn(async () => ({ transaction_hash: "0x99", order: 7n }));
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
  it("coordinates missing actor snapshots without blocking known actors or waiting for signatures", async () => {
    const { store, write } = await fixture();
    write("SliceRules", [1n], { ...preset.rules, game_id: 1 });
    let releaseSnapshot!: () => void;
    let releaseSignature!: () => void;
    const snapshot = new Promise<void>((resolve) => {
      releaseSnapshot = resolve;
    });
    const signature = new Promise<void>((resolve) => {
      releaseSignature = resolve;
    });
    const prepare = vi.fn(async (actor: string) => {
      if (actor === "0x222") await snapshot;
      if (actor === "0x333") {
        store.applyEntityOperations([
          {
            type: "remove-components",
            entityId: hash.computePoseidonHashOnElements([1n, 0x222n]),
            models: ["ActionNonce"],
          },
        ]);
      }
      write("ActionNonce", [1n, BigInt(actor)], { game_id: 1, actor, next_nonce: actor === "0x222" ? "0" : "7" });
    });
    const signIntent = vi.fn(async (actor: AccountInterface) => {
      if (actor.address === "0x222") await signature;
      return { r: 1n, s: 2n, publicKey: 3n };
    });
    const submitIntent = vi.fn(async (_action: SignedNativeIntent) => ({ transaction_hash: "0x99", order: 7n }));
    const send = nativeSubmission({ bindings, chainId: "0x1", signIntent, submitIntent }, store, 1, "0x101", prepare);
    const call = {
      contractAddress: "0x101",
      entrypoint: "CloseBitcoinPhase",
      calldata: ["1", ...encodeNativeCommand(bindings.commandAbi, { kind: "CloseBitcoinPhase", value: 42n })],
    };
    const first = send({ address: "0x222" } as AccountInterface, call);
    const second = send({ address: "0x333" } as AccountInterface, call);
    await send({ address: "0x111" } as AccountInterface, call);
    expect(prepare.mock.calls).toEqual([["0x222"]]);
    expect(submitIntent).toHaveBeenCalledOnce();
    releaseSnapshot();
    await second;
    expect(prepare.mock.calls).toEqual([["0x222"], ["0x333"]]);
    expect(submitIntent).toHaveBeenCalledTimes(2);
    expect(store.get("ActionNonce", { game_id: 1, actor: 0x222n })).toBeUndefined();
    releaseSignature();
    await first;
    expect(submitIntent.mock.calls.map(([action]) => action.intent.map(BigInt)[6])).toEqual([0n, 7n, 0n]);
  });

  it("releases snapshot coordination after a failed actor snapshot", async () => {
    const { store, write } = await fixture();
    write("SliceRules", [1n], { ...preset.rules, game_id: 1 });
    const prepare = vi.fn(async (actor: string) => {
      if (actor === "0x222") throw new Error("Gameplay nonce from Herald timed out");
      write("ActionNonce", [1n, BigInt(actor)], { game_id: 1, actor, next_nonce: "0" });
    });
    const signIntent = vi.fn(async () => ({ r: 1n, s: 2n, publicKey: 3n }));
    const submitIntent = vi.fn(async () => ({ transaction_hash: "0x99", order: 7n }));
    const send = nativeSubmission({ bindings, chainId: "0x1", signIntent, submitIntent }, store, 1, "0x101", prepare);
    const call = {
      contractAddress: "0x101",
      entrypoint: "CloseBitcoinPhase",
      calldata: ["1", ...encodeNativeCommand(bindings.commandAbi, { kind: "CloseBitcoinPhase", value: 42n })],
    };
    const failed = expect(send({ address: "0x222" } as AccountInterface, call)).rejects.toThrow("timed out");
    await send({ address: "0x333" } as AccountInterface, call);
    await failed;
    expect(prepare.mock.calls).toEqual([["0x222"], ["0x333"]]);
    expect(signIntent).toHaveBeenCalledOnce();
    expect(submitIntent).toHaveBeenCalledOnce();
  });
});
