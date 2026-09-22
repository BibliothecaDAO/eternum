import { expect, it } from "vitest";
import { LiveWorld } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import { receipt, rowEvent, rulesEvent, setup } from "./native/fixtures";
import type { HeraldStreamMessage } from "./stream-protocol";
import type { RpcBlockWithReceipts } from "./types";

it("preserves the whole Blitz game's facts through snapshot, overlay, confirmation and reconnect", async () => {
  const { native, decoder, fold } = setup();
  const tiles = [50, 150].map((col) => rowEvent("TileOpt", ["1", "0", String(col), "50"], ["1"]));
  const balances = [1, 2].map((id) => rowEvent("ResourceBalance", ["1", String(id), "28"], [String(id * 100)]));
  native.applyReceipt(
    fold,
    receipt([
      rowEvent("GameRegistry", ["1"], ["7", "2", "10", "0", "1", "0", "120", "120", "999999", "0", "7"]),
      rulesEvent(),
      rowEvent("SettlementRules", ["1"], ["0", "0", "0", "100"]),
      ...tiles,
      ...balances,
      rowEvent("TileOpt", ["2", "0", "250", "50"], ["1"]),
    ]),
    9,
    0,
  );
  const confirmed: RpcBlockWithReceipts = { block_number: 10, timestamp: 120, transactions: [] };
  const live = new LiveWorld({
    native,
    registry: decoder.registry,
    chain: "madara",
    checkpointEveryBlocks: 100,
    checkpointStore: { save: async () => undefined },
    confirmedBlock: 9,
    confirmedFold: fold,
    rpc: {
      getBlockWithReceipts: async (block: unknown) =>
        block === "pre_confirmed"
          ? { block_number: confirmed.block_number + 1, timestamp: 121, transactions: [] }
          : confirmed,
    } as unknown as MadaraRpc,
  });
  const connect = (actor: string) => {
    const messages: HeraldStreamMessage[] = [];
    const session = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) }, actor);
    return { session, messages };
  };
  const players = ["0xa", "0xb"].map(connect);
  const facts = (messages: HeraldStreamMessage[]) =>
    messages.flatMap((message) =>
      message.type === "snapshot" && message.model !== "ActionNonce"
        ? [{ model: message.model, rows: message.rows }]
        : [],
    );
  const expected = fold.snapshot("1", 9).models.filter(({ model }) => model !== "ActionNonce");
  for (const player of players) {
    live.resume(player.session, { type: "resume", epoch: "", seq: 0 });
    expect(facts(player.messages)).toEqual(expected);
    expect(facts(player.messages).find(({ model }) => model === "TileOpt")?.rows).toHaveLength(2);
    expect(facts(player.messages).find(({ model }) => model === "ResourceBalance")?.rows).toHaveLength(2);
    player.messages.length = 0;
  }
  const update = receipt(
    [
      rowEvent("TileOpt", ["1", "0", "50", "50"], ["2"]),
      rowEvent("TileOpt", ["1", "0", "150", "50"], ["3"]),
      rowEvent("ResourceBalance", ["1", "1", "28"], ["80"]),
      rowEvent("ResourceBalance", ["1", "2", "28"], ["180"]),
    ],
    "0x71",
  );
  live.acceptReceipt({ ...update, finality_status: "PRE_CONFIRMED" });
  for (const player of players) {
    const diffs = player.messages.filter((message) => message.type === "diff");
    expect(diffs).toHaveLength(1);
    expect(diffs[0].set.map(({ model }) => model).sort()).toEqual([
      "ResourceBalance",
      "ResourceBalance",
      "TileOpt",
      "TileOpt",
    ]);
    expect(diffs[0].del).toEqual([]);
    expect(diffs[0].preconfirmed).toBe(true);
  }
  expect(players[0].messages.map(({ epoch, ...message }) => message)).toEqual(
    players[1].messages.map(({ epoch, ...message }) => message),
  );
  confirmed.transactions.push({ receipt: update, transaction: { type: "INVOKE" } });
  await live.acceptSubscribedHead({ block_number: 10, timestamp: 120 });
  const boundary = players[0].messages.at(-1)!;
  live.detach(players[0].session);
  confirmed.block_number = 11;
  confirmed.transactions = [];
  await live.acceptSubscribedHead({ block_number: 11, timestamp: 121 });
  const resumed = connect("0xa");
  live.resume(resumed.session, { type: "resume", epoch: boundary.epoch, seq: boundary.seq });
  expect(resumed.messages.some(({ type }) => type === "snapshot")).toBe(false);
  expect(resumed.messages.at(-1)).toMatchObject({ type: "head", block: 11 });
  const fresh = connect("0xb");
  live.resume(fresh.session, { type: "resume", epoch: "", seq: 0 });
  expect(facts(fresh.messages)).toEqual(fold.snapshot("1", 11).models.filter(({ model }) => model !== "ActionNonce"));
});
