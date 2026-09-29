import { CairoCustomEnum } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { LiveWorld } from "./live-world";
import type { HistoryStore } from "./history-store";
import type { MadaraRpc } from "./madara-rpc";
import {
  structureValue,
  explorerValue,
  seedDerivedRows,
  receipt,
  rowEvent,
  rulesEvent,
  schema,
  setup,
} from "./native/fixtures";
import type { HeraldStreamMessage } from "./stream-protocol";
import type { RpcBlockWithReceipts } from "./types";

function fixture(historyStore?: HistoryStore) {
  const { native, fold, decoder } = setup();
  const tile = (value: string) => rowEvent("TileOpt", ["1", "0", "12", "34"], { data: value });
  const confirmed: RpcBlockWithReceipts = { block_number: 10, timestamp: 100, transactions: [] };
  const pending: RpcBlockWithReceipts = { block_number: 11, timestamp: 101, transactions: [] };
  const rpc = {
    blockNumber: async () => confirmed.block_number,
    getPreconfirmedHeader: async () => pending,
    getBlockWithReceipts: async (block: unknown) => (block === "pre_confirmed" ? pending : confirmed),
  } as unknown as MadaraRpc;
  const live = new LiveWorld({
    native,
    registry: decoder.registry,
    chain: "madara",
    checkpointEveryBlocks: 100,
    checkpointStore: { save: vi.fn() },
    confirmedBlock: 9,
    confirmedFold: fold,
    rpc,
    historyStore,
  });
  const messages: Array<Record<string, unknown>> = [];
  const connection = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) });
  live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
  messages.length = 0;
  const submit = (value: string, hash = "0x1") =>
    live.acceptReceipt({ ...receipt([tile(value)], hash), finality_status: "PRE_CONFIRMED" });
  const confirm = (value: string) =>
    confirmed.transactions.push({ receipt: receipt([tile(value)]), transaction: { type: "INVOKE" } });
  return { live, messages, submit, confirm, confirmed, pending, fold, native, tile, decoder };
}

describe("native live publication", () => {
  it("publishes complete receipts once and keeps confirmed snapshots separate from the overlay", () => {
    const { live, messages, submit } = fixture();
    submit("1");
    submit("1");
    expect(messages.filter((message) => message.type === "diff")).toHaveLength(1);
    expect(live.snapshot("1").models.find((model) => model.model === "TileOpt")!.rows).toEqual([]);
    const reconnected: Array<Record<string, unknown>> = [];
    const connection = live.attach("1", { send: (text) => reconnected.push(JSON.parse(text)) });
    live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
    expect(reconnected.some((message) => message.type === "diff")).toBe(true);
    expect(reconnected.every((message) => !("deletedRows" in message))).toBe(true);
  });

  it("waits for the history commit before publishing the confirmed head", async () => {
    let release!: () => void;
    const appendEvents = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { live, messages, confirm } = fixture({
      appendEvents,
      freezeReviewSnapshot: vi.fn(),
    } as unknown as HistoryStore);
    confirm("1");
    const update = live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    await vi.waitFor(() => expect(appendEvents).toHaveBeenCalledOnce());
    expect(messages.filter((message) => message.type === "head")).toEqual([]);
    release();
    await update;
    expect(live.confirmedBlock).toBe(10);
    expect(messages.some((message) => message.type === "head")).toBe(true);
  });

  it("advances completeness even when the confirmed block has no story events", async () => {
    const appendEvents = vi.fn(async () => {});
    const { live } = fixture({ appendEvents, freezeReviewSnapshot: vi.fn() } as unknown as HistoryStore);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(appendEvents).toHaveBeenCalledWith([], 10);
  });

  it("does not republish repeated heads or a clock that has not advanced", async () => {
    const { live, messages, pending } = fixture();
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    messages.length = 0;
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(messages).toEqual([]);
    await live.publishChainClock();
    await live.publishChainClock();
    expect(messages.filter((message) => message.type === "head")).toHaveLength(1);
    pending.timestamp++;
    await live.publishChainClock();
    expect(messages.filter((message) => message.type === "head")).toHaveLength(2);
  });

  it("names the last confirmed head's time in hello, which a pre-confirmed clock tick leaves as it is", async () => {
    const { live, pending } = fixture();
    const hello = () => {
      const sent: Array<Record<string, unknown>> = [];
      live.attach("1", { send: (text) => sent.push(JSON.parse(text)) });
      return sent[0];
    };
    expect(hello()).toMatchObject({ type: "hello", confirmed_timestamp: null });

    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    pending.timestamp = 500;
    await live.publishChainClock();

    expect(hello()).toMatchObject({ type: "hello", confirmed_block: 10, confirmed_timestamp: 100 });
  });

  it("warns for a LORDS commitment only after its receipt is confirmed, once per day", async () => {
    const { live, native, fold, confirmed, pending, decoder } = fixture();
    native.applyReceipt(
      fold,
      receipt(
        seedDerivedRows(fold, decoder, [
          rowEvent("GameRegistry", ["1"], {
            name: "0x46",
            preset_id: 4,
            creator: "0x111",
            settled: false,
            ready: true,
            dev_mode_on: false,
            start_settling_at: 0,
            start_main_at: 100,
            end_at: 99999999,
            end_grace_seconds: 0,
            seed: 42,
          }),
          rulesEvent("1"),
          rowEvent("SettlementRules", ["1"], {
            registration_start: 0,
            registration_limit: 0,
            mode: new CairoCustomEnum({ Single: {} }),
            spacing: 100,
          }),
          rowEvent("ChestRules", ["1"], {
            relic_probability: 90,
            token_cap: 1,
            lords_amounts: { common: 100, uncommon: 400, rare: 1500, epic: 6000 },
            lords_pool: 1000000,
            season_epochs: 70,
          }),
        ]),
      ),
      9,
      0,
    );
    seedDerivedRows(fold, decoder, [
      rowEvent("SliceRules", ["1"], { ...fold.modelRows("SliceRules")[0].value, epoch_seconds: 86400 }),
    ]);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const reward = receipt([rowEvent("LordsBudget", ["1"], { lords_committed: 11428 })], "0x991");
      live.acceptReceipt({ ...reward, finality_status: "PRE_CONFIRMED" });
      pending.timestamp = 86401;
      await live.publishChainClock();
      expect(warn).not.toHaveBeenCalled();
      confirmed.block_number = 11;
      confirmed.timestamp = 200;
      confirmed.transactions.push({ receipt: reward, transaction: { type: "INVOKE" } });
      await live.acceptSubscribedHead({ block_number: 11, timestamp: 200 });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({
        event: "frontier_lords_allowance_80_percent",
        absolute_epoch: 0,
        season_day: 0,
        allowance: "14285",
      });
      await live.acceptSubscribedHead({ block_number: 11, timestamp: 201 });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("invalidates directory readers only after confirmed changes", async () => {
    const { live, submit, confirm } = fixture();
    const changed = vi.fn();
    const unsubscribe = live.subscribeConfirmedChanges(changed);
    submit("1");
    expect(changed).not.toHaveBeenCalled();
    confirm("1");
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(changed).toHaveBeenCalledWith(new Set(["TileOpt"]));
    unsubscribe();
  });

  it("reverts a provisional row missing from the rebuilt block", async () => {
    const { live, messages, submit } = fixture();
    submit("1");
    messages.length = 0;
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    const diffs = messages.filter((message) => message.type === "diff");
    expect(diffs.some((message) => (message.del as unknown[]).length === 1)).toBe(true);
  });

  it("keeps two expedition scopes isolated through depth changes, overlay reset, reconnect and rollover", async () => {
    const { native, decoder, fold } = setup();
    const event = rulesEvent();
    const rules = decoder.decodeRowSet("SliceRules", ["1"], event.data.slice(3));
    if (rules.kind !== "set") throw new Error("Expected rules row");
    rules.value.epoch_seconds = 86_400;
    const dayStart = Date.parse("2026-09-22T00:00:00Z") / 1000;
    const beforeMidnight = dayStart + 86_399;
    fold.apply(rules);
    const homes = [1, 2].map((id) =>
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
      }),
    );
    const armies = [1, 2].map((id) =>
      rowEvent("ExplorerTroops", ["1", String(id * 10)], explorerValue(String(id), 1000n, 120n, 1n)),
    );
    const positions = [1, 2].map((id) =>
      rowEvent("TileOccupancy", ["1", "0", String(id * 100 - 50), "50"], {
        entity_id: String(id * 10),
        category: "15",
        is_structure: false,
      }),
    );
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
            start_settling_at: String(dayStart + 120),
            start_main_at: String(dayStart + 120),
            end_at: String(dayStart + 864_000),
            end_grace_seconds: "0",
            seed: "7",
          }),
          rowEvent("SettlementRules", ["1"], {
            registration_start: 0n,
            registration_limit: 0n,
            mode: new CairoCustomEnum({ Single: {} }),
            spacing: 100n,
          }),
          ...homes,
          ...armies,
          ...positions,
          rowEvent("ExpeditionDiscovery", ["1", "1", String(Math.floor(dayStart / 86400))], { empty_reveals: 7 }),
          rowEvent("ExpeditionDiscovery", ["1", "2", String(Math.floor(dayStart / 86400))], { empty_reveals: 3 }),
          rowEvent("TileOccupancy", ["1", "0", "51", "50"], { entity_id: 300, category: 34, is_structure: false }),
          rowEvent("ResourceBalance", ["1", "1", "28"], { balance: 100n }),
          rowEvent("ResourceBalance", ["1", "2", "28"], { balance: 200n }),
          ...[1, 2, 10, 20].flatMap((entityId) => [
            rowEvent("ResourceWeight", ["1", String(entityId)], { capacity: 1000n, weight: 100n }),
            rowEvent("EntityName", ["1", String(entityId)], { name: String(entityId) }),
          ]),
          rowEvent("ResourceProduction", ["1", "100", "29"], {
            building_count: 1n,
            production_rate: 10n,
            output_amount_left: 100n,
            last_updated_at: 120n,
          }),
          rowEvent("ResourceProduction", ["1", "99", "29"], {
            building_count: 1n,
            production_rate: 10n,
            output_amount_left: 100n,
            last_updated_at: 120n,
          }),
          rowEvent("TileOpt", ["1", "0", "50", "50"], { data: 1n }),
          rowEvent("TileOpt", ["1", "0", "150", "50"], { data: 1n }),
          rowEvent("TileOpt", ["1", "0", "50", "150"], { data: 1n }),
          rowEvent("TileOpt", ["1", "0", "50", "450"], { data: 1n }),
          rowEvent("TileOpt", ["1", "0", "150", "450"], { data: 1n }),
        ]),
      ),
      9,
      0,
    );
    const confirmed: RpcBlockWithReceipts = { block_number: 10, timestamp: beforeMidnight, transactions: [] };
    const pending: RpcBlockWithReceipts = { block_number: 11, timestamp: beforeMidnight, transactions: [] };
    const live = new LiveWorld({
      native,
      registry: decoder.registry,
      chain: "madara",
      checkpointEveryBlocks: 100,
      checkpointStore: { save: async () => undefined },
      confirmedBlock: 9,
      confirmedFold: fold,
      rpc: {
        getPreconfirmedHeader: async () => pending,
        getBlockWithReceipts: async (block: unknown) => (block === "pre_confirmed" ? pending : confirmed),
      } as unknown as MadaraRpc,
    });
    await live.acceptSubscribedHead({ block_number: 10, timestamp: beforeMidnight });
    const messages: HeraldStreamMessage[][] = [[], []];
    const sessions = ["0xa", "0xb"].map((actor, index) => {
      const session = live.attach("1", { send: (text) => messages[index].push(JSON.parse(text)) }, actor);
      live.resume(session, { type: "resume", epoch: "", seq: 0 });
      return session;
    });
    for (const [index, stream] of messages.entries()) {
      const snapshots = stream.filter((message) => message.type === "snapshot");
      const foreignEntities = new Set(index === 0 ? [2, 20, 100] : [1, 10, 99]);
      const checkedEntityKeys = new Set<string>();
      for (const snapshot of snapshots) {
        const model = schema.models.find(({ name }) => name === snapshot.model)!;
        // Entity-id aliases become u32 in the schema; check every non-game u32 key, including spatial keys.
        const entityKeys = model.keys.filter(({ name, type }) => name !== "game_id" && type === "core::integer::u32");
        for (const row of snapshot.rows) {
          for (const { name } of entityKeys) {
            checkedEntityKeys.add(`${snapshot.model}.${name}`);
            expect(foreignEntities.has(Number(row.value[name])), `${snapshot.model}.${name}`).toBe(false);
          }
        }
      }
      expect(checkedEntityKeys.size).toBeGreaterThan(0);
      expect(
        snapshots
          .find((message) => message.model === "ExpeditionDiscovery")
          ?.rows.map((row) => Number(row.value.empty_reveals)),
      ).toEqual([index === 0 ? 7 : 3]);

      expect(
        snapshots.find((message) => message.model === "Structure")?.rows.map((row) => Number(row.value.entity_id)),
      ).toEqual([index + 1]);
      expect(
        snapshots
          .find((message) => message.model === "ExplorerTroops")
          ?.rows.map((row) => Number(row.value.explorer_id)),
      ).toEqual([(index + 1) * 10]);
      expect(
        snapshots.find((message) => message.model === "TileOpt")?.rows.map((row) => Number(row.value.col)),
      ).toEqual([index * 100 + 50]);
    }
    messages.forEach((stream) => {
      stream.length = 0;
    });
    live.acceptReceipt({
      ...receipt(
        [
          rowEvent("TileOpt", ["1", "0", "150", "50"], { data: 2n }),
          rowEvent("ResourceBalance", ["1", "2", "28"], { balance: 180n }),
        ],
        "0x70",
      ),
      finality_status: "PRE_CONFIRMED",
    });
    expect(messages[0]).toEqual([]);
    const otherRegion = messages[1].filter((message) => message.type === "diff");
    expect(otherRegion).toHaveLength(1);
    expect(otherRegion[0].set.map((row) => row.model).sort()).toEqual(["ResourceBalance", "TileOpt"]);
    const surfaceKey = fold
      .gameRows("TileOpt", "1")
      .find((row) => Number(row.value.col) === 50 && Number(row.value.row) === 50)!.key;
    const depthKey = fold.gameRows("TileOpt", "1").find((row) => Number(row.value.row) === 150)!.key;
    messages.forEach((stream) => {
      stream.length = 0;
    });
    const descended = rowEvent("TileOccupancy", ["1", "0", "50", "150"], {
      entity_id: 10n,
      category: 15n,
      is_structure: false,
    });
    const removedPosition = {
      ...positions[0],
      keys: [
        ...schema.games.events.find((event) => event.name === "RowDeleted")!.prefix,
        "1",
        schema.models.find((model) => model.name === "TileOccupancy")!.identity,
      ],
      data: ["4", "1", "0", "50", "50"],
    };
    live.acceptReceipt({
      ...receipt([removedPosition, descended, rowEvent("ResourceBalance", ["1", "1", "28"], { balance: 80n })], "0x71"),
      finality_status: "PRE_CONFIRMED",
    });
    const depthDiffs = messages[0].filter((message) => message.type === "diff");
    expect(depthDiffs).toHaveLength(1);
    expect(depthDiffs[0].set).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: "TileOpt", key: depthKey }),
        expect.objectContaining({ model: "ResourceBalance", value: expect.objectContaining({ balance: "0x50" }) }),
      ]),
    );
    expect(depthDiffs[0].del).toContainEqual({ model: "TileOpt", key: surfaceKey });
    expect(messages[1]).toEqual([]);

    confirmed.block_number = 11;
    pending.block_number = 12;
    messages[0].length = 0;
    await live.acceptSubscribedHead({ block_number: 11, timestamp: beforeMidnight });
    expect(messages[0].filter((message) => message.type === "diff").flatMap((message) => message.del)).toContainEqual({
      model: "TileOpt",
      key: depthKey,
    });
    expect(messages[0].filter((message) => message.type === "diff").flatMap((message) => message.set)).toContainEqual(
      expect.objectContaining({ model: "TileOpt", key: surfaceKey }),
    );

    const boundary = messages[0].at(-1)!;
    messages.forEach((stream) => {
      stream.length = 0;
    });
    pending.timestamp = dayStart + 86_400;
    await live.publishChainClock();
    for (const [index, stream] of messages.entries()) {
      expect(stream.some((message) => message.type === "hello" || message.type === "snapshot")).toBe(false);
      const diffs = stream.filter((message) => message.type === "diff");
      const tiles = diffs.flatMap((message) => message.set).filter((row) => row.model === "TileOpt");
      expect(tiles.map((row) => [Number(row.value.col), Number(row.value.row)])).toEqual([[index * 100 + 50, 450]]);
      const yesterday = fold
        .gameRows("TileOpt", "1")
        .find((row) => Number(row.value.col) === index * 100 + 50 && Number(row.value.row) === 50)!;
      expect(diffs.flatMap((message) => message.del)).toContainEqual({ model: "TileOpt", key: yesterday.key });
    }
    live.detach(sessions[0]);
    const reconnected: HeraldStreamMessage[] = [];
    const resumed = live.attach("1", { send: (text) => reconnected.push(JSON.parse(text)) }, "0xa");
    live.resume(resumed, { type: "resume", epoch: boundary.epoch, seq: boundary.seq });
    expect(reconnected.some((message) => message.type === "snapshot")).toBe(false);
    const removed = reconnected.filter((message) => message.type === "diff").flatMap((message) => message.del);
    expect(removed).toContainEqual({ model: "TileOpt", key: surfaceKey });
    expect(removed.some((row) => row.model === "ExplorerTroops")).toBe(true);
    expect(removed.some((row) => row.model === "Structure" || row.model === "ResourceBalance")).toBe(false);
    const today = live.snapshot("1", undefined, "0xa");
    expect(today.models.find((model) => model.model === "ExplorerTroops")?.rows).toEqual([]);
    expect(today.models.find((model) => model.model === "ExpeditionDiscovery")?.rows).toEqual([]);
    expect(removed.some((row) => row.model === "ExpeditionDiscovery")).toBe(true);
    expect(
      today.models
        .find((model) => model.model === "TileOccupancy")
        ?.rows.some((row) => Number(row.value.category) === 34),
    ).toBe(false);
    expect(today.models.find((model) => model.model === "Structure")?.rows).toHaveLength(1);
    expect(
      today.models
        .find((model) => model.model === "ResourceProduction")
        ?.rows.map((row) => Number(row.value.entity_id)),
    ).toEqual([]);

    reconnected.length = 0;
    live.selectActor(resumed, "0xb");
    expect(reconnected.some((message) => message.type === "snapshot")).toBe(false);
    const selection = reconnected.find((message) => message.type === "scope")!;
    expect(selection.set.filter((row) => row.model === "Structure").map((row) => Number(row.value.entity_id))).toEqual([
      2,
    ]);
    expect(selection.set.some((row) => row.model === "SliceRules")).toBe(false);
  });
});
