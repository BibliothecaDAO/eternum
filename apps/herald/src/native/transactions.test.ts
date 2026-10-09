import { CallData, byteArray, hash, shortString } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { LiveWorld } from "../live-world";
import type { MadaraRpc } from "../madara-rpc";
import type { RpcBlockWithReceipts } from "../types";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { manifest, receipt, setup } from "./fixtures";
import { transactionScopes } from "./transactions";

const SENDER = "0x111";

/** One account call of Games.play: game, release, preset commitment, then the command span. */
function playCall(game: number | string) {
  const calldata = [String(game), "1", "0x789", "1", "7"];
  return [manifest.world.address, hash.getSelectorFromName("play"), String(calldata.length), ...calldata];
}

const play = (game: number | string) => ({
  type: "INVOKE",
  sender_address: SENDER,
  calldata: ["1", ...playCall(game)],
});

function rejectedEvent(transactionHash: string) {
  return {
    from_address: manifest.world.address,
    keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x1", SENDER, transactionHash],
    data: [
      shortString.encodeShortString("GAMEPLAY_REJECTED"),
      ...CallData.compile(byteArray.byteArrayFromString("explorer is dead")),
    ],
  };
}

function liveWorld(
  native: ReturnType<typeof setup>["native"],
  decoder: ReturnType<typeof setup>["decoder"],
  fold: ReturnType<typeof setup>["fold"],
  rpc = {} as MadaraRpc,
  historyStore?: unknown,
) {
  return new LiveWorld({
    native,
    registry: decoder.registry,
    chain: "madara",
    checkpointEveryBlocks: 100,
    checkpointStore: { save: vi.fn() },
    confirmedBlock: 9,
    confirmedFold: fold,
    rpc,
    ...(historyStore ? { historyStore: historyStore as never } : {}),
  });
}

function streamOf(live: LiveWorld, gameId = "1") {
  const messages: Record<string, unknown>[] = [];
  const connection = live.attach(gameId, { send: (value) => messages.push(JSON.parse(value)) }, SENDER);
  live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
  messages.length = 0;
  return messages;
}

describe("native transaction receipt routing", () => {
  it("routes a play call to its game, with the sending account as the actor", () => {
    expect(transactionScopes(manifest, play(4))).toEqual([{ gameId: "4", actor: String(BigInt(SENDER)) }]);
  });

  it("routes nothing that is not Games.play, and refuses a malformed account call", () => {
    const foreign = playCall(1);
    foreign[0] = "0x999";
    expect(transactionScopes(manifest, { sender_address: SENDER, calldata: ["1", ...foreign] })).toEqual([]);
    const other = playCall(1);
    other[1] = hash.getSelectorFromName("create_game");
    expect(transactionScopes(manifest, { sender_address: SENDER, calldata: ["1", ...other] })).toEqual([]);
    expect(transactionScopes(manifest, { calldata: ["1", ...playCall(1)] })).toEqual([]);
    expect(() => transactionScopes(manifest, play(0))).toThrow("Malformed play call");
    expect(() => transactionScopes(manifest, { ...play(1), calldata: ["1", ...playCall(1).slice(0, -1)] })).toThrow();
    expect(() => transactionScopes(manifest, { ...play(1), calldata: ["1", ...playCall(1), "0"] })).toThrow();
  });

  it("streams a pre-roll revert to its game with the revert reason, though it emitted nothing", async () => {
    const { native, decoder, fold } = setup();
    const reverted = { ...receipt([], "0xdead"), execution_status: "REVERTED", revert_reason: "stale release" };
    const block: RpcBlockWithReceipts = {
      block_number: 10,
      timestamp: 100,
      transactions: [{ receipt: reverted, transaction: play(1) }],
    };
    const live = liveWorld(native, decoder, fold, {
      getBlockWithReceipts: async (number: unknown) =>
        number === "pre_confirmed" ? { ...block, block_number: 11, transactions: [] } : block,
    } as unknown as MadaraRpc);
    const messages = streamOf(live);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(messages.filter((message) => message.type === "tx")).toEqual([
      expect.objectContaining({ hash: "0xdead", block: 10, status: "REVERTED", revert_reason: "stale release" }),
    ]);
  });

  it("streams an applied action after its facts, by its finality, when either notification was lost", async () => {
    const { native, decoder, fold } = setup();
    const applied = receipt([setFixture.raw], "0xabc");
    const block: RpcBlockWithReceipts = {
      block_number: 10,
      timestamp: 100,
      transactions: [{ receipt: applied, transaction: play(1) }],
    };
    const live = liveWorld(native, decoder, fold, {
      getBlockWithReceipts: async (number: unknown) =>
        number === "pre_confirmed" ? { ...block, block_number: 11, transactions: [] } : block,
    } as unknown as MadaraRpc);
    const messages = streamOf(live);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(messages.filter((message) => message.type === "tx").at(-1)).toMatchObject({
      hash: "0xabc",
      block: 10,
      status: "ACCEPTED_ON_L2",
    });
    expect(messages.findIndex((message) => message.type === "diff")).toBeLessThan(
      messages.findIndex((message) => message.type === "tx"),
    );
  });

  it("reads the game's refusal from the receipt: rolled back, its class and reason, never applied", () => {
    const { native } = setup();
    const refused = receipt([rejectedEvent("0x124")], "0x124");
    expect(native.outcomeReceipt(refused)).toMatchObject({
      rejection: { statusClass: "GAMEPLAY_REJECTED", reason: "explorer is dead" },
    });
    expect(native.outcomeReceipt(receipt([], "0x125"))).not.toHaveProperty("rejection");
  });

  it.each(["PRE_CONFIRMED", "ACCEPTED_ON_L2"])(
    "streams a refused action at %s as REJECTED with the game's class and reason",
    (finality_status) => {
      const { native, decoder, fold } = setup();
      const historyStore = { recordTransaction: vi.fn() };
      const live = liveWorld(native, decoder, fold, {} as MadaraRpc, historyStore);
      const messages = streamOf(live);
      // The compiled schema on this branch predates GameplayRejected, so its decode is the receipt reader's alone.
      vi.spyOn(native, "outcomeReceipt").mockImplementation((value) => ({
        ...value,
        rejection: { statusClass: "GAMEPLAY_REJECTED", reason: "explorer is dead" },
      }));
      live.acceptTransaction({ finality_status: "PRE_CONFIRMED", transaction_hash: "0x124", ...play(1) });
      live.acceptReceipt({ ...receipt([], "0x124"), finality_status });
      expect(messages.filter((message) => message.type === "tx").at(-1)).toMatchObject({
        hash: "0x124",
        status: "REJECTED",
        status_class: "GAMEPLAY_REJECTED",
        revert_reason: "explorer is dead",
      });
      if (finality_status === "ACCEPTED_ON_L2")
        expect(historyStore.recordTransaction).toHaveBeenCalledWith(
          "1",
          expect.objectContaining({ rejection: expect.anything() }),
        );
      else expect(historyStore.recordTransaction).not.toHaveBeenCalled();
    },
  );
});
