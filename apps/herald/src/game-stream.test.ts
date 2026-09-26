import { describe, expect, it, vi } from "vitest";

import { HERALD_GAME_FINALIZED_CLOSE } from "@bibliothecadao/eternum/game-sync";
import { GameStreamHub, type StreamSocket } from "./game-stream";
import { scopeLookup } from "@bibliothecadao/eternum/game-sync-models";
import { rowStreamKeys } from "./subscription-keys";
import { setup, rowEvent, receipt, schema } from "./native/fixtures";
import { GameFinalizedError } from "./world-fold";
import type { GameSnapshot } from "./types";

const snapshot: GameSnapshot = {
  confirmed_block: 12,
  game_id: "7",
  models: [{ model: "TestModel", rows: [{ key: "0x1", value: { game_id: "0x7", value: "0x1" } }] }],
};

const recordingSocket = (): StreamSocket & { messages: Array<Record<string, unknown>> } => {
  const messages: Array<Record<string, unknown>> = [];
  return {
    messages,
    send: (data) => messages.push(JSON.parse(data) as Record<string, unknown>),
  };
};

describe("GameStreamHub", () => {
  it("attaches before the snapshot boundary and emits later messages without a gap", () => {
    const hub = new GameStreamHub("epoch-a");
    const socket = recordingSocket();
    const session = hub.attach({
      confirmedBlock: 12,
      gameId: "7",
      overlay: () => [],
      preconfirmedBlock: 13,
      snapshot: () => {
        hub.publishHead("7", 13, 100);
        return snapshot;
      },
      socket,
    });
    hub.resume(session, { epoch: "", seq: 0, type: "resume" });

    expect(socket.messages.map(({ type, seq }) => [type, seq])).toEqual([
      ["hello", 0],
      ["snapshot", 0],
      ["snapshot_end", 0],
      ["head", 1],
    ]);
    expect(socket.messages.every(({ epoch }) => epoch === "epoch-a:7:")).toBe(true);
  });

  it("names the last confirmed head's chain time in hello, and null before Herald has one", () => {
    const hub = new GameStreamHub("epoch-a");
    const known = recordingSocket();
    hub.attach({
      confirmedBlock: 12,
      confirmedTimestamp: 1_790_194_601,
      gameId: "7",
      overlay: () => [],
      preconfirmedBlock: 13,
      snapshot: () => snapshot,
      socket: known,
    });
    expect(known.messages[0]).toMatchObject({ type: "hello", confirmed_block: 12, confirmed_timestamp: 1_790_194_601 });

    const unknown = recordingSocket();
    hub.attach({
      confirmedBlock: 12,
      gameId: "7",
      overlay: () => [],
      preconfirmedBlock: 13,
      snapshot: () => snapshot,
      socket: unknown,
    });
    expect(unknown.messages[0]).toMatchObject({ type: "hello", confirmed_timestamp: null });
  });

  it("counts every frame and byte a subscriber is sent, and each snapshot's own", () => {
    const log = { info: vi.fn() };
    const hub = new GameStreamHub("epoch-a", log);
    const sent: string[] = [];
    const session = hub.attach({
      confirmedBlock: 12,
      gameId: "7",
      overlay: () => [],
      preconfirmedBlock: 13,
      snapshot: () => snapshot,
      socket: { send: (data) => sent.push(data) },
    });
    hub.resume(session, { epoch: "", seq: 0, type: "resume" });
    hub.publishHead("7", 13, 100);
    hub.detach(session);

    const bytes = (frames: string[]) => frames.reduce((total, frame) => total + Buffer.byteLength(frame), 0);
    const [snapshotSent, traffic] = log.info.mock.calls.map(([line]) => JSON.parse(line as string));
    expect(snapshotSent).toMatchObject({
      event: "herald_snapshot_sent",
      kind: "snapshot",
      frames: 2,
      bytes: bytes(sent.slice(1, 3)),
    });
    expect(traffic).toMatchObject({ event: "herald_subscriber_traffic", frames: 4, bytes: bytes(sent), snapshots: 1 });
  });

  it("keeps an idle stream resumable for a ring window, then drops it and its ring", () => {
    vi.useFakeTimers();
    const hub = new GameStreamHub("epoch-a", { info: vi.fn() });
    const attach = (socket = recordingSocket()) => ({
      socket,
      session: hub.attach({
        actor: "0x111",
        confirmedBlock: 12,
        gameId: "7",
        overlay: () => [],
        preconfirmedBlock: 13,
        snapshot: () => snapshot,
        socket,
      }),
    });
    const first = attach();
    hub.resume(first.session, { epoch: "", seq: 0, type: "resume" });
    expect(first.session.snapshot).toBeUndefined();
    hub.publishHead("7", 13, 100);
    const epoch = first.socket.messages.at(-1)!.epoch as string;
    hub.detach(first.session);

    vi.advanceTimersByTime(10 * 60 * 1_000);
    hub.publishHead("7", 14, 101);
    const soon = attach();
    hub.resume(soon.session, { epoch, seq: 1, type: "resume" });
    expect(soon.socket.messages.map(({ type }) => type)).toEqual(["hello", "head"]);
    hub.detach(soon.session);

    vi.advanceTimersByTime(10 * 60 * 1_000 + 1);
    hub.publishHead("7", 15, 102);
    const late = attach();
    hub.resume(late.session, { epoch, seq: 2, type: "resume" });
    expect(late.socket.messages.map(({ type }) => type)).toEqual(["hello", "snapshot", "snapshot_end"]);
    vi.useRealTimers();
  });

  it("resumes a killed socket by sequence and snapshots after an epoch change", () => {
    const hub = new GameStreamHub("epoch-a");
    const firstSocket = recordingSocket();
    const first = hub.attach({
      confirmedBlock: 12,
      gameId: "7",
      overlay: () => [],
      preconfirmedBlock: null,
      snapshot: () => snapshot,
      socket: firstSocket,
    });
    hub.resume(first, { epoch: "", seq: 0, type: "resume" });
    hub.publishHead("7", 13, 100);
    hub.publishDiff("7", { block: 13, del: [], preconfirmed: false, set: [] });
    hub.detach(first);

    const resumedSocket = recordingSocket();
    const resumed = hub.attach({
      confirmedBlock: 13,
      gameId: "7",
      overlay: () => [],
      preconfirmedBlock: 14,
      snapshot: () => snapshot,
      socket: resumedSocket,
    });
    hub.resume(resumed, { epoch: "epoch-a:7:", seq: 1, type: "resume" });
    expect(resumedSocket.messages.map(({ type, seq }) => [type, seq])).toEqual([
      ["hello", 2],
      ["diff", 2],
    ]);

    const restartedHub = new GameStreamHub("epoch-b");
    const restartedSocket = recordingSocket();
    const restarted = restartedHub.attach({
      confirmedBlock: 13,
      gameId: "7",
      overlay: () => [],
      preconfirmedBlock: null,
      snapshot: () => snapshot,
      socket: restartedSocket,
    });
    restartedHub.resume(restarted, { epoch: "epoch-a:7:", seq: 2, type: "resume" });
    expect(restartedSocket.messages.map(({ type }) => type)).toEqual(["hello", "snapshot", "snapshot_end"]);
    expect(restartedSocket.messages.every(({ epoch }) => epoch === "epoch-b:7:")).toBe(true);
  });

  it("sends the confirmed snapshot before transaction-grouped overlay diffs at the same boundary", () => {
    const hub = new GameStreamHub("epoch-a");
    const socket = recordingSocket();
    const session = hub.attach({
      confirmedBlock: 12,
      gameId: "7",
      overlay: () => [
        {
          block: 13,
          del: [],
          set: [{ key: "0x2", model: "TestModel", value: { game_id: "0x7", value: "0x2" } }],
        },
        {
          block: 13,
          del: [{ key: "0x3", model: "TestModel" }],
          set: [],
        },
      ],
      preconfirmedBlock: 13,
      snapshot: () => snapshot,
      socket,
    });

    hub.resume(session, { epoch: "", seq: 0, type: "resume" });
    hub.publishHead("7", 13, 100);

    expect(socket.messages.map(({ type, seq }) => [type, seq])).toEqual([
      ["hello", 0],
      ["snapshot", 0],
      ["snapshot_end", 0],
      ["diff", 0],
      ["diff", 0],
      ["head", 1],
    ]);
    expect(socket.messages.slice(3, 5).every(({ preconfirmed }) => preconfirmed === true)).toBe(true);
  });
  it("projects a diff only to the states its rows name, and a shared row to every state", () => {
    const hub = new GameStreamHub("epoch-a", { info: vi.fn() });
    const projected = { "0x1": vi.fn((body) => [body]), "0x2": vi.fn((body) => [body]) };
    for (const [actor, project] of Object.entries(projected))
      hub.attach({
        actor,
        confirmedBlock: 12,
        gameId: "7",
        interest: () => new Set([`region:${actor}`]),
        overlay: () => [],
        preconfirmedBlock: 13,
        project,
        snapshot: () => snapshot,
        socket: recordingSocket(),
      });
    const row = (region: string) => ({ key: "0x9", model: "TileOpt", value: { region } });
    const keys = (row: { value: Record<string, unknown> }) =>
      row.value.region === "shared" ? ("everyone" as const) : [`region:${row.value.region}`];
    const diff = (set: ReturnType<typeof row>[], del: { key: string; model: string }[] = []) =>
      hub.publishDiff(
        "7",
        { block: 13, del, preconfirmed: true, set },
        keys,
        del.map(() => row("0x1")),
      );

    diff([row("0x1")]);
    expect([projected["0x1"].mock.calls.length, projected["0x2"].mock.calls.length]).toEqual([1, 0]);
    diff([row("shared")]);
    diff([], [{ key: "0x9", model: "TileOpt" }]);
    expect([projected["0x1"].mock.calls.length, projected["0x2"].mock.calls.length]).toEqual([3, 1]);
  });
  it("routes an army move's deletion by its old tile and army, including after the fold removed it", () => {
    const { fold, native } = setup();
    const placed = rowEvent("TileOccupancy", ["7", "0", "3", "3"], {
      entity_id: 70n,
      category: 15n,
      is_structure: false,
    });
    native.applyReceipt(fold, receipt([placed]), 10, 0);
    const removed = {
      ...placed,
      keys: [
        ...schema.games.events.find(({ name }) => name === "RowDeleted")!.prefix,
        "1",
        schema.models.find(({ name }) => name === "TileOccupancy")!.identity,
      ],
      data: ["4", "7", "0", "3", "3"],
    };
    const { changes } = native.applyReceipt(fold, receipt([removed]), 11, 0);
    const deletion = changes.find(({ change }) => change?.del)!.change!;
    expect(fold.currentRow(deletion.del!.model, deletion.del!.key)).toBeUndefined();
    const hub = new GameStreamHub("epoch-a", { info: vi.fn() });
    const projects = [vi.fn((body) => [body]), vi.fn((body) => [body]), vi.fn((body) => [body])];
    const interests = [scopeLookup.occupancyIn("0:0"), scopeLookup.occupancyOf("70"), scopeLookup.occupancyOf("80")];
    projects.forEach((project, index) =>
      hub.attach({
        actor: String(index + 1),
        confirmedBlock: 10,
        gameId: "7",
        interest: () => new Set([interests[index]]),
        overlay: () => [],
        preconfirmedBlock: 11,
        project,
        snapshot: () => snapshot,
        socket: recordingSocket(),
      }),
    );
    hub.publishDiff(
      "7",
      { block: 11, del: [deletion.del!], preconfirmed: false, set: [] },
      (row) => rowStreamKeys(row.model, row.value, 21),
      [deletion.previous!],
    );
    expect(projects.map((project) => project.mock.calls.length)).toEqual([1, 1, 0]);
    expect(projects[0].mock.calls[0][0]).not.toHaveProperty("previous");
  });

  it("bounds retained replay across games and 2,000 actors and snapshots after eviction", () => {
    const hub = new GameStreamHub("epoch-a", { info: vi.fn() }, 64 * 1024);
    const attach = (actor: string, gameId = "7", socket = recordingSocket()) => ({
      socket,
      session: hub.attach({
        actor,
        gameId,
        confirmedBlock: 12,
        overlay: () => [],
        preconfirmedBlock: null,
        snapshot: () => snapshot,
        socket,
      }),
    });
    for (let actor = 1; actor <= 2000; actor++) {
      const { session } = attach(String(actor), actor <= 1000 ? "7" : "8");
      hub.resume(session, { epoch: "", seq: 0, type: "resume" });
      hub.detach(session);
    }
    for (let block = 13; block < 23; block++) {
      hub.publishHead("7", block, 100);
      hub.publishHead("8", block, 100);
      expect(hub.replayUsage().bytes).toBeLessThanOrEqual(64 * 1024);
      expect(hub.replayUsage().entries).toBeLessThan(256);
    }
    const evicted = attach("1");
    hub.resume(evicted.session, { epoch: "epoch-a:7:1", seq: 1, type: "resume" });
    expect(evicted.socket.messages.map(({ type }) => type)).toEqual(["hello", "snapshot", "snapshot_end"]);
    const recent = attach("2000", "8");
    hub.resume(recent.session, { epoch: "epoch-a:8:2000", seq: 9, type: "resume" });
    expect(recent.socket.messages.map(({ type }) => type)).toEqual(["hello", "head"]);
  });

  it("refreshes an attach snapshot if its replay boundary expires before resume", () => {
    const hub = new GameStreamHub("epoch-a", { info: vi.fn() }, 1024);
    const socket = recordingSocket();
    let block = 12;
    const capture = vi.fn(() => ({ ...snapshot, confirmed_block: block }));
    const session = hub.attach({
      gameId: "7",
      confirmedBlock: block,
      overlay: () => [],
      preconfirmedBlock: null,
      snapshot: capture,
      socket,
    });
    for (block = 13; block < 30; block++) hub.publishHead("7", block, 100);
    hub.resume(session, { epoch: "", seq: 0, type: "resume" });
    expect(capture).toHaveBeenCalledTimes(2);
    expect(socket.messages.map(({ type, seq }) => [type, seq])).toEqual([
      ["hello", 0],
      ["snapshot", 17],
      ["snapshot_end", 17],
    ]);
  });

  it("expires replay by age even below the byte budget and discards oversized frames", () => {
    vi.useFakeTimers();
    try {
      const hub = new GameStreamHub("epoch-a", { info: vi.fn() }, 1024);
      hub.attach({
        gameId: "7",
        confirmedBlock: 12,
        overlay: () => [],
        preconfirmedBlock: null,
        snapshot: () => snapshot,
        socket: recordingSocket(),
      });
      hub.publishHead("7", 13, 100);
      expect(hub.replayUsage().entries).toBe(1);
      expect(hub.replayUsage().oldestAgeSeconds).toBe(0);
      vi.advanceTimersByTime(1000);
      expect(hub.replayUsage().oldestAgeSeconds).toBe(1);
      vi.advanceTimersByTime(600_001);
      expect(hub.replayUsage().entries).toBe(0);
      expect(hub.replayUsage().oldestAgeSeconds).toBeNull();
      hub.publishDiff("7", {
        block: 14,
        del: [],
        preconfirmed: false,
        set: [{ key: "1", model: "TestModel", value: { text: "x".repeat(1024) } }],
      });
      expect(hub.replayUsage().bytes).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ends only the stream whose projection fails, by name, and keeps publishing to the rest", () => {
    const hub = new GameStreamHub("epoch-a", { info: vi.fn() });
    const sockets = {
      "0x1": { ...recordingSocket(), close: vi.fn() },
      "0x2": { ...recordingSocket(), close: vi.fn() },
    };
    for (const [actor, socket] of Object.entries(sockets)) {
      const session = hub.attach({
        actor,
        confirmedBlock: 12,
        gameId: "7",
        overlay: () => [],
        preconfirmedBlock: 13,
        project: (body) => {
          if (actor === "0x1") throw new GameFinalizedError("7", ["TileOpt"]);
          return [body];
        },
        snapshot: () => snapshot,
        socket,
      });
      hub.resume(session, { epoch: "", seq: 0, type: "resume" });
    }
    expect(() => hub.publishHead("7", 14, 200)).not.toThrow();
    expect(sockets["0x1"].close).toHaveBeenCalledWith(HERALD_GAME_FINALIZED_CLOSE, "game_finalized");
    expect(sockets["0x2"].messages.at(-1)).toMatchObject({ type: "head", block: 14 });
  });
  it("names only the games someone streams, and forgets a game with its last stream", () => {
    vi.useFakeTimers();
    const hub = new GameStreamHub("epoch-a", { info: vi.fn() });
    const socket = recordingSocket();
    const session = hub.attach({
      actor: "0x111",
      confirmedBlock: 12,
      gameId: "7",
      overlay: () => [],
      preconfirmedBlock: 13,
      snapshot: () => snapshot,
      socket,
    });
    expect(hub.streamedGames()).toEqual(["7"]);
    hub.detach(session);
    vi.advanceTimersByTime(10 * 60 * 1_000 + 1);
    hub.publishHead("7", 14, 101);
    expect(hub.streamedGames()).toEqual([]);
    vi.useRealTimers();
  });

  it("leaves no stream state behind when an attach is refused", () => {
    const hub = new GameStreamHub("epoch-a", { info: vi.fn() });
    const project = vi.fn((body) => [body]);
    const attach = (snapshot: () => GameSnapshot) =>
      hub.attach({
        actor: "0x1",
        confirmedBlock: 12,
        gameId: "7",
        overlay: () => [],
        preconfirmedBlock: 13,
        project,
        snapshot,
        socket: recordingSocket(),
      });
    expect(() =>
      attach(() => {
        throw new GameFinalizedError("7", ["TileOpt"]);
      }),
    ).toThrow(GameFinalizedError);
    hub.publishHead("7", 14, 200);
    expect(project).not.toHaveBeenCalled();

    hub.resume(
      attach(() => snapshot),
      { epoch: "", seq: 0, type: "resume" },
    );
    hub.publishHead("7", 15, 201);
    expect(project).toHaveBeenCalledTimes(1);
  });
});
