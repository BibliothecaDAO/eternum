import { describe, expect, it, vi } from "vitest";

import { revealedTileData, type HomeRingTile, type HomeRingView } from "./home-ring";
import { LiveWorld } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import { raw, receipt, rowEvent, rulesEvent, setup } from "./native/fixtures";
import type { HeraldStreamMessage } from "./stream-protocol";
import type { RpcBlockWithReceipts } from "./types";
import { WorldFold } from "./world-fold";

const DAY_START = Date.parse("2026-09-22T00:00:00Z") / 1000;
const MID_DAY = DAY_START + 43_200;

// Realm 1's day-one site with spacing 100 is (50, 50); its ring is the site and the six tiles around it.
const RING: HomeRingTile[] = [
  [50, 50],
  [51, 50],
  [51, 51],
  [50, 51],
  [49, 50],
  [50, 49],
  [51, 49],
].map(([col, row]) => ({ col: col!, row: row!, biome: 5 }));

/** A Frontier game (days of 86,400 s, regions of 100) with realm 1 owned by 0xa and realm 2 by 0xb, and no armies. */
const frontierWorld = (homeRingView: HomeRingView) => {
  const { native, decoder, fold } = setup();
  const rules = decoder.decode(raw(rulesEvent()));
  if (rules.kind !== "set") throw new Error("Expected rules row");
  rules.value.epoch_seconds = 86_400;
  fold.apply(rules);
  const home = (id: number) =>
    rowEvent(
      "Structure",
      ["1", String(id)],
      [
        String(id + 9),
        ...["0", "0", "2", "120", "1", "0", "0", "0", "1", "0", "0", "0"],
        String(id),
        ...["0", "0", "0", "0", "1", "0"],
      ],
    );
  native.applyReceipt(
    fold,
    receipt([
      rowEvent(
        "GameRegistry",
        ["1"],
        [
          "7",
          "1",
          "10",
          "0",
          "1",
          "0",
          String(DAY_START + 120),
          String(DAY_START + 120),
          String(DAY_START + 864_000),
        ].concat(["0", "7"]),
      ),
      rowEvent("SettlementRules", ["1"], ["0", "0", "0", "100"]),
      home(1),
      home(2),
    ]),
    9,
    0,
  );
  const confirmed: RpcBlockWithReceipts = { block_number: 10, timestamp: MID_DAY, transactions: [] };
  const live = new LiveWorld({
    native,
    registry: decoder.registry,
    chain: "madara",
    checkpointEveryBlocks: 100,
    checkpointStore: { save: async () => undefined },
    confirmedBlock: 9,
    confirmedFold: fold,
    homeRingView,
    rpc: {
      getPreconfirmedHeader: async () => ({ ...confirmed, block_number: 11 }),
      getBlockWithReceipts: async () => confirmed,
    } as unknown as MadaraRpc,
  });
  return { live, native, decoder };
};

const connect = (live: LiveWorld, actor: string) => {
  const messages: HeraldStreamMessage[] = [];
  const session = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) }, actor);
  live.resume(session, { type: "resume", epoch: "", seq: 0 });
  return messages;
};

const tilesIn = (messages: HeraldStreamMessage[]) =>
  messages.flatMap((message) => {
    if (message.type === "snapshot" && message.model === "TileOpt") return message.rows;
    if (message.type === "diff") return message.set.filter(({ model }) => model === "TileOpt");
    return [];
  });

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("home ring", () => {
  it("reads a watched realm's ring once a day and shows it on connect, on arrival and on reconnect", async () => {
    const view = vi.fn<HomeRingView>(async () => RING);
    const { live, decoder } = frontierWorld(view);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: MID_DAY });

    // A fresh connect mid-day starts the read; the ring arrives as a diff when it lands.
    const first = connect(live, "0xa");
    expect(tilesIn(first)).toEqual([]);
    await settle();
    expect(view).toHaveBeenCalledTimes(1);
    expect(view).toHaveBeenCalledWith("1", 1, MID_DAY);
    // Each row is exactly the row the chain writes when it reveals the tile.
    const chainRows = RING.map((tile) => {
      const event = decoder.decode(
        raw(rowEvent("TileOpt", ["1", "0", String(tile.col), String(tile.row)], [revealedTileData(tile).toString()])),
      );
      const { set } = new WorldFold(decoder.registry).apply(event)!;
      return { key: set!.key, model: set!.model, value: set!.value };
    });
    expect(tilesIn(first)).toEqual(chainRows);

    // A connect after the ring is cached, and a reconnect, get it in the snapshot with no second read.
    for (const messages of [connect(live, "0xa"), connect(live, "0xa")]) {
      expect(tilesIn(messages)).toEqual(chainRows.map(({ key, value }) => ({ key, value })));
    }
    await settle();
    expect(view).toHaveBeenCalledTimes(1);
  });

  it("never reads the ring of a realm nobody is watching", async () => {
    const view = vi.fn<HomeRingView>(async () => RING);
    const { live } = frontierWorld(view);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: MID_DAY });
    connect(live, "0xa");
    await settle();
    expect(view.mock.calls.map(([, realmId]) => realmId)).toEqual([1]);
  });

  it("asks again on the next connect after a failed read, without breaking the stream", async () => {
    const view = vi.fn<HomeRingView>().mockRejectedValueOnce(new Error("node down")).mockResolvedValue(RING);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { live } = frontierWorld(view);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: MID_DAY });
    connect(live, "0xa");
    await settle();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("herald_home_ring_failed"));
    const retried = connect(live, "0xa");
    await settle();
    expect(view).toHaveBeenCalledTimes(2);
    expect(tilesIn(retried)).toHaveLength(RING.length);
    error.mockRestore();
  });
});
