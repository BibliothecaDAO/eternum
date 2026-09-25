import { GameSubscription } from "./game-subscription";
import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { isClientGameSyncModel } from "@bibliothecadao/eternum/game-sync-models";

import { decodeHomeRing, type HomeRingTile, type HomeRingView } from "./home-ring";
import { LiveWorld } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import { seedDerivedRows, raw, receipt, rowEvent, rulesEvent, setup } from "./native/fixtures";
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
const frontierWorld = (homeRingView?: HomeRingView, call?: MadaraRpc["call"]) => {
  const { native, decoder, fold } = setup();
  const event = rulesEvent();
  const rules = decoder.decodeRowSet("SliceRules", ["1"], event.data.slice(3));
  if (rules.kind !== "set") throw new Error("Expected rules row");
  rules.value.epoch_seconds = 86_400;
  fold.apply(rules);
  const home = (id: number) =>
    rowEvent(
      "Structure",
      ["1", String(id)],
      [String(id + 9), ...["0", "2", "120", "1", "0", "1", "0"], String(id), ...["0", "0", "0", "0", "1", "0"]],
    );
  native.applyReceipt(
    fold,
    receipt(
      seedDerivedRows(fold, decoder, [
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
    ),
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
      call,
    } as unknown as MadaraRpc,
  });
  return { live, native, decoder, fold };
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
  it("refuses an empty or short view response instead of reading a ring of no tiles", () => {
    expect(decodeHomeRing(["0x1", "0x0", "0x5", "0x6", "0x2"])).toEqual([{ col: 5, row: 6, biome: 2 }]);
    expect(() => decodeHomeRing([])).toThrow("expedition_home_ring returned 0 felts");
    expect(() => decodeHomeRing(["0x2", "0x0", "0x5", "0x6", "0x2"])).toThrow("returned 5 felts");
  });

  it("keeps spires and reservations in tile scope without treating them as positioned entities", () => {
    const { native, fold } = frontierWorld();
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("TileOccupancy", ["1", "0", "50", "50"], ["999", "35", "1"]),
        rowEvent("TileOccupancy", ["1", "1", "50", "50"], ["999", "35", "1"]),
        rowEvent("TileOccupancy", ["1", "0", "51", "50"], ["0", "39", "1"]),
      ]),
      10,
      0,
    );
    const scope = fold.subscriptionScope("1", "0xa", MID_DAY);
    expect(scope.expedition?.entities.has("999")).toBe(false);
    expect(scope.expedition?.entities.has("0")).toBe(false);
  });

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
        raw(
          rowEvent("TileOpt", ["1", "0", String(tile.col), String(tile.row)], [(BigInt(tile.biome) << 41n).toString()]),
        ),
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

  it("reads the ring through a view the deployed Games contract exposes", async () => {
    const felts = [
      String(RING.length),
      ...RING.flatMap(({ col, row, biome }) => ["0", String(col), String(row), String(biome)]),
    ];
    const call = vi.fn<MadaraRpc["call"]>(async () => felts);
    const { live, decoder } = frontierWorld(undefined, call);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: MID_DAY });
    const messages = connect(live, "0xa");
    await settle();
    // The shard's own schema names the entrypoint, so a view only a logic class has would be refused before the call.
    expect(call).toHaveBeenCalledWith(
      decoder.registry.worldAddress,
      "expedition_home_ring",
      ["1", "1", String(MID_DAY)],
      10,
    );
    expect(tilesIn(messages)).toHaveLength(RING.length);
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

describe("client and Herald subscription scope parity", () => {
  it("keeps Frontier absence unknown across actor, overlay and day boundaries", () => {
    const { native, fold } = frontierWorld();
    const overlay = fold.overlay();
    const store = new NativeFactStore();
    const guardReads: unknown[] = [];
    store.subscribe(() => guardReads.push(store.requireOrAbsent("Guard", { game_id: 1, structure_id: 1, slot: 0 })));
    let actor = "0xa";
    let timestamp = MID_DAY;
    let subscription: GameSubscription;
    const state = (complete: boolean, clock: number | undefined = timestamp) =>
      store.setSnapshot({ gameId: 1, actor, complete, timestamp: clock });
    const snapshot = () => {
      state(false);
      subscription = new GameSubscription(
        "1",
        actor,
        (preconfirmed) => (preconfirmed ? overlay : fold),
        () => 10,
        () => timestamp,
      );
      const models = subscription.snapshot().models.filter(({ model }) => isClientGameSyncModel(model));
      store.applyFacts(
        models.flatMap(({ model, rows }) => rows.map((row) => ({ ...row, model }))),
        new Map(models.map(({ model, rows }) => [model, new Set(rows.map(({ key }) => key))])),
      );
      expect(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: BigInt(actor) }).unknown).toContain(
        "INCOMPLETE_SNAPSHOT",
      );
      state(true);
      expect(store.subscriptionScope().known).toEqual(fold.subscriptionScope("1", actor, timestamp));
    };
    snapshot();
    expect(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: 0xan }).known?.points).toBe(0n);
    expect(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: 0xbn }).unknown).toContain(
      "OUTSIDE_SNAPSHOT_SCOPE",
    );
    actor = "0xb";
    snapshot();
    // Clock invalidation cannot block an applied actor snapshot's first action.
    store.setSnapshot({ gameId: 1, actor, complete: true, timestamp: undefined });
    expect(store.requireOrAbsent("ActionNonce", { game_id: 1, actor: 0xbn }).known?.next_nonce).toBe(0n);
    expect(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: 0xbn }).unknown).toBe("UNKNOWN_SCOPE_CLOCK");
    state(true);

    const result = native.applyReceipt(overlay, receipt([rowEvent("PlayerEntry", ["1", "0xa"], ["0xb"])]), null, 0);
    const deliver = (bodies: ReturnType<GameSubscription["project"]>) => {
      for (const body of bodies) {
        if (body.type === "diff") {
          store.setSnapshot({ gameId: 1, actor, complete: true, timestamp: undefined });
          store.applyFacts([
            ...body.set.filter(({ model }) => isClientGameSyncModel(model)),
            ...body.del.filter(({ model }) => isClientGameSyncModel(model)).map((row) => ({ ...row, value: null })),
          ]);
          expect(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: 0xan }).unknown).toBe(
            "UNKNOWN_SCOPE_CLOCK",
          );
        } else if (body.type === "head") state(true, timestamp);
      }
    };
    deliver(
      subscription!.project({
        type: "diff",
        block: null,
        preconfirmed: true,
        set: result.changes.flatMap(({ change }) => (change?.set ? [change.set] : [])),
        del: [],
      }),
    );
    expect(fold.subscriptionScope("1", actor, timestamp).expedition?.owners).toEqual(new Set(["11"]));
    deliver(subscription!.project({ type: "head", block: 11, preconfirmed: true, timestamp }));
    expect(store.subscriptionScope().known).toEqual(overlay.subscriptionScope("1", actor, timestamp));
    expect(store.requireOrAbsent("PlayerPoints", { game_id: 1, address: 0xan }).known?.points).toBe(0n);
    expect(store.requireOrAbsent("ActionNonce", { game_id: 1, actor: 0xan }).unknown).toContain(
      "OUTSIDE_SNAPSHOT_SCOPE",
    );

    timestamp += 86_400;
    deliver(subscription!.project({ type: "head", block: 12, preconfirmed: true, timestamp }));
    expect(store.subscriptionScope().known).toEqual(overlay.subscriptionScope("1", actor, timestamp));
    expect(store.requireOrAbsent("ChestTokens", { game_id: 1, player: 0xbn, epoch: 0n }).unknown).toContain(
      "OUTSIDE_SNAPSHOT_SCOPE",
    );
    expect(store.requireOrAbsent("ChestTokens", { game_id: 1, player: 0xbn, epoch: 1n }).known?.count).toBe(0);
    expect(guardReads.some((read) => (read as { unknown?: string }).unknown === "UNKNOWN_SCOPE_CLOCK")).toBe(true);
  });
});
