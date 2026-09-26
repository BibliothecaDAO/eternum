import { productionOutput } from "@bibliothecadao/eternum";
import { readFileSync } from "node:fs";
import { CairoCustomEnum } from "starknet";
import { absoluteEpoch } from "@bibliothecadao/eternum/expeditions";
import { GameSubscription } from "./game-subscription";
import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { rowInGameSyncScope, isClientGameSyncModel } from "@bibliothecadao/eternum/game-sync-models";

import { decodeHomeRing, homeRingTileData, type HomeRingTile, type HomeRingView } from "./home-ring";
import { LiveWorld } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import {
  structureValue,
  explorerValue,
  seedDerivedRows,
  raw,
  receipt,
  rowEvent,
  rulesEvent,
  setup,
} from "./native/fixtures";
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
    rowEvent("Structure", ["1", String(id)], {
      ...structureValue,
      owner: id + 9,
      base: {
        ...structureValue.base,
        troop_max_explorer_count: 2,
        created_at: 120,
        category: 1,
        starting_troops_granted: true,
      },
      metadata: { ...structureValue.metadata, realm_id: id },
    });
  native.applyReceipt(
    fold,
    receipt(
      seedDerivedRows(fold, decoder, [
        rowEvent("GameRegistry", ["1"], {
          name: "7",
          preset_id: "1",
          creator: "10",
          settled: false,
          ready: true,
          dev_mode_on: false,
          start_settling_at: String(DAY_START + 120),
          start_main_at: String(DAY_START + 120),
          end_at: String(DAY_START + 864_000),
          end_grace_seconds: "0",
          seed: "7",
        }),
        rowEvent("SettlementRules", ["1"], {
          registration_start: 0n,
          registration_limit: 0n,
          mode: new CairoCustomEnum({ Single: {} }),
          spacing: 100n,
        }),
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
  it("matches the materialized Cairo ring across three season days", () => {
    const values = readFileSync(
      new URL("../../../contracts/l3/world-native/tests/fixtures/frontier-home-ring-v1.txt", import.meta.url),
      "utf8",
    )
      .trim()
      .split(/\s+/)
      .map(BigInt);
    expect(values.slice(0, 2)).toEqual([1n, 21n]);
    expect(values).toHaveLength(2 + 21 * 5);
    for (let day = 0; day < 3; day++) {
      const wire = ["7"];
      const materialized: bigint[] = [];
      for (let tile = 0; tile < 7; tile++) {
        const offset = 2 + (day * 7 + tile) * 5;
        const [timestamp, col, row, biome, data] = values.slice(offset, offset + 5);
        expect(timestamp).toBe(350n + BigInt(day) * 100n);
        wire.push("0", col!.toString(), row!.toString(), biome!.toString());
        materialized.push(data!);
      }
      expect(decodeHomeRing(wire).map(homeRingTileData)).toEqual(materialized);
    }
  });

  it("scopes slot and chest rows by absolute epoch on a nonzero launch day", () => {
    const { fold } = frontierWorld();
    const absolute = absoluteEpoch({ epochSeconds: 86_400 }, MID_DAY);
    const scope = fold.subscriptionScope("1", "0xa", MID_DAY);
    expect(scope.expedition?.absoluteEpoch).toBe(absolute);
    expect(scope.expedition?.regions).toEqual(new Set(["0:0"]));
    for (const [model, key] of [
      ["ArmySlot", { structure_id: "1", slot: "0" }],
      ["ChestTokens", { player: "10" }],
      ["ChestReward", { player: "10", explorer_id: "11", index: "0" }],
    ] as const) {
      expect(rowInGameSyncScope(model, { ...key, epoch: String(absolute) }, scope)).toBe(true);
      expect(rowInGameSyncScope(model, { ...key, epoch: "0" }, scope)).toBe(false);
      const next = fold.subscriptionScope("1", "0xa", MID_DAY + 86_400);
      expect(rowInGameSyncScope(model, { ...key, epoch: String(absolute) }, next)).toBe(false);
      expect(rowInGameSyncScope(model, { ...key, epoch: String(absolute + 1) }, next)).toBe(true);
    }
    expect(fold.subscriptionScope("1", "0xa", DAY_START).expedition?.absoluteEpoch).toBe(-1);
  });

  it("retains Support accrual inputs across midnight, visit and refreshed snapshots", () => {
    const { native, fold } = frontierWorld();
    const midnight = DAY_START + 86_400;
    const epoch = absoluteEpoch({ epochSeconds: 86400 }, midnight - 10);
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("RealmSupport", ["1", "1", String(epoch)], { level: 3 }),
        rowEvent("RealmSupport", ["1", "2", String(epoch)], { level: 2 }),
        rowEvent("ResourceWeight", ["1", "1"], { capacity: 100000, weight: 0 }),
        rowEvent("ResourceProduction", ["1", "1", "35"], {
          building_count: 1,
          production_rate: 100,
          output_amount_left: (1n << 128n) - 1n,
          last_updated_at: midnight - 10,
        }),
      ]),
      11,
      0,
    );
    const visited = fold.subscriptionSnapshot("1", 11, fold.subscriptionScope("1", "0xa", midnight + 10, "0xb"));
    expect(visited.models.find((m) => m.model === "RealmSupport")!.rows).toHaveLength(2);
    const snapshot = fold.subscriptionSnapshot("1", 11, fold.subscriptionScope("1", "0xa", midnight + 10));
    expect(snapshot.models.find((m) => m.model === "RealmSupport")!.rows).toHaveLength(1);
    for (let refresh = 0; refresh < 2; refresh++) {
      const store = new NativeFactStore();
      store.applyFacts(snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, ...row }))));
      store.setSnapshot({ gameId: 1, complete: true, actor: "0xa", timestamp: midnight + 10 });
      const production = store.require("ResourceProduction", { game_id: 1, entity_id: 1, resource_type: 35 });
      const support = store.requireOrAbsent("RealmSupport", { game_id: 1, structure_id: 1, epoch: BigInt(epoch) });
      expect(productionOutput(production, midnight + 10, { epochSeconds: 86400, level: support.known!.level })).toBe(
        2200n,
      );
      expect(
        store.requireOrAbsent("RealmSupport", { game_id: 1, structure_id: 1, epoch: BigInt(epoch + 1) }).known?.level,
      ).toBe(0);
    }
  });

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
        rowEvent("TileOccupancy", ["1", "0", "50", "50"], { entity_id: 999n, category: 35n, is_structure: true }),
        rowEvent("TileOccupancy", ["1", "1", "50", "50"], { entity_id: 999n, category: 35n, is_structure: true }),
        rowEvent("TileOccupancy", ["1", "0", "51", "50"], { entity_id: 0n, category: 39n, is_structure: true }),
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
          rowEvent("TileOpt", ["1", "0", String(tile.col), String(tile.row)], {
            data: homeRingTileData(tile).toString(),
          }),
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

    const result = native.applyReceipt(
      overlay,
      receipt([rowEvent("PlayerEntry", ["1", "0xa"], { player: 11n })]),
      null,
      0,
    );
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
    expect(
      store.requireOrAbsent("ChestTokens", {
        game_id: 1,
        player: 0xbn,
        epoch: BigInt(absoluteEpoch({ epochSeconds: 86_400 }, DAY_START)),
      }).unknown,
    ).toContain("OUTSIDE_SNAPSHOT_SCOPE");
    expect(
      store.requireOrAbsent("ChestTokens", {
        game_id: 1,
        player: 0xbn,
        epoch: BigInt(absoluteEpoch({ epochSeconds: 86_400 }, timestamp)),
      }).known?.count,
    ).toBe(0);
    expect(guardReads.some((read) => (read as { unknown?: string }).unknown === "UNKNOWN_SCOPE_CLOCK")).toBe(true);
  });
});

describe("visited realm subscription", () => {
  it("includes buildings and knowledge, excludes the visited army's region, and drops visit rows on leaving", async () => {
    const { live, fold, native } = frontierWorld(async (_gameId, realmId) =>
      RING.map((tile) => ({ ...tile, col: tile.col + (realmId - 1) * 100 })),
    );
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("PlayerEntry", ["1", "11"], { player: "187" }),
        rowEvent("RealmKnowledge", ["1", "1"], { learned: 0 }),
        rowEvent("RealmKnowledge", ["1", "2"], { learned: 3 }),
        rowEvent("Building", ["1", "2", "10", "10"], {
          category: 37,
          paused: false,
          labor_paid: 200000000000n,
          tier: 2,
        }),
        rowEvent("ExplorerTroops", ["1", "20"], explorerValue("2", 1000n, 30n, 1n)),
        rowEvent("TileOccupancy", ["1", "0", "150", "150"], { entity_id: 20, category: 15, is_structure: false }),
        rowEvent("TileOpt", ["1", "0", "150", "150"], { data: 5n << 41n }),
        rowEvent("ActionNonce", ["1", "10"], { next_nonce: 7 }),
        rowEvent("ActionNonce", ["1", "11"], { next_nonce: 9 }),
      ]),
      9,
      1,
    );
    await live.acceptSubscribedHead({ block_number: 10, timestamp: MID_DAY });
    const messages: HeraldStreamMessage[] = [];
    const session = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) }, "0xa", "0xbb");
    live.resume(session, { type: "resume", epoch: "", seq: 0 });
    await settle();
    const snapshot = messages
      .filter((message) => message.type === "snapshot")
      .flatMap(({ model, rows }) => rows.map((row) => ({ ...row, model })));
    expect(
      snapshot.filter((row) => row.model === "RealmKnowledge").map((row) => Number(row.value.structure_id)),
    ).toEqual([1, 2]);
    expect(snapshot.filter((row) => row.model === "Building")).toHaveLength(1);
    expect(snapshot.filter((row) => row.model === "ExplorerTroops")).toHaveLength(1);
    expect(snapshot.filter((row) => row.model === "ActionNonce").map((row) => Number(row.value.actor))).toEqual([10]);
    expect(tilesIn(messages).some((row) => Number(row.value.col) >= 100)).toBe(false);
    expect(fold.subscriptionScope("1", "0xa", MID_DAY, "0xbb").expedition?.regions).toEqual(new Set(["0:0"]));
    messages.length = 0;
    live.selectActor(session, "0xa");
    const scope = messages.find((message) => message.type === "scope")!;
    expect(scope.visit).toBeUndefined();
    expect(
      scope.set.filter((row) => row.model === "RealmKnowledge").map((row) => Number(row.value.structure_id)),
    ).toEqual([1]);
    expect(scope.set.some((row) => row.model === "Building" || row.model === "ExplorerTroops")).toBe(false);
  });
});
