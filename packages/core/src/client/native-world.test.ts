import { encodeNativeCommand } from "@bibliothecadao/provider";
import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "./native-fact-store";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { hash, type AccountInterface } from "starknet";
import bindingsJson from "../../../../contracts/l3/world-native/schema/bindings.json";
import { nativePlay } from "./native-submission";

const bindings = bindingsJson as unknown as NativeWorldBindings;
const GAMES = "0x101";
const EXPLORE = encodeNativeCommand(bindings.commandAbi, { kind: "Explore", value: { explorer_id: 7, direction: 2 } });
const exploreCall = { contractAddress: GAMES, entrypoint: "Explore", calldata: ["1", ...EXPLORE] };

const storeWithRelease = (releaseId: number) => {
  const store = new NativeFactStore();
  const writeRelease = (id: number) =>
    store.applyFacts([
      {
        model: "GameRelease",
        key: hash.computePoseidonHashOnElements([1n]),
        value: { game_id: 1, release_id: id, preset_commitment: "0x789" },
      },
    ]);
  writeRelease(releaseId);
  return { store, writeRelease };
};

const accountSending = (transactionHash: string) =>
  ({
    address: "0x111",
    execute: vi.fn(async () => ({ transaction_hash: transactionHash })),
  }) as unknown as AccountInterface & { execute: ReturnType<typeof vi.fn> };

describe("a game command as the player's own invoke", () => {
  it("sends one Games.play call with the game, its current release pins and the command as a span", async () => {
    const { store, writeRelease } = storeWithRelease(1);
    let openGate!: () => void;
    const ready = vi.fn(() => new Promise<void>((resolve) => (openGate = resolve)));
    const account = accountSending("0x99");
    const sent = nativePlay({ bindings, release: { ready } }, store, 1, GAMES)(account, exploreCall);

    // The pins are read once the release gate opens, so a release that changed meanwhile is the one sent.
    writeRelease(2);
    openGate();
    await expect(sent).resolves.toEqual({ transaction_hash: "0x99" });
    expect(account.execute).toHaveBeenCalledOnce();
    expect(account.execute.mock.calls[0]![0]).toEqual({
      contractAddress: GAMES,
      entrypoint: "play",
      calldata: ["1", "2", String(0x789n), String(EXPLORE.length), ...EXPLORE],
    });
  });

  it("refuses a command for another game, contract or variant before the account sends anything", async () => {
    const { store } = storeWithRelease(1);
    const account = accountSending("0x99");
    const send = nativePlay({ bindings, release: { ready: async () => {} } }, store, 1, GAMES);

    await expect(send(account, { ...exploreCall, entrypoint: "Move" })).rejects.toThrow("discriminant mismatch");
    await expect(send(account, { ...exploreCall, calldata: ["2", ...EXPLORE] })).rejects.toThrow("game mismatch");
    await expect(send(account, { ...exploreCall, contractAddress: "0x202" })).rejects.toThrow("Invalid native command");
    await expect(send(account, [exploreCall, exploreCall])).rejects.toThrow("one command per action");
    expect(account.execute).not.toHaveBeenCalled();
  });
});
