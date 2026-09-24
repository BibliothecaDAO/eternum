import { describe, expect, it, vi } from "vitest";

import { HERALD_GAME_FINALIZED_CLOSE } from "@bibliothecadao/eternum/game-sync";
import { GameStreamHub, type StreamSocket } from "./game-stream";
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
  it("projects a diff only to the states its rows name, and a shared row or a delete to every state", () => {
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
      hub.publishDiff("7", { block: 13, del, preconfirmed: true, set }, keys);

    diff([row("0x1")]);
    expect([projected["0x1"].mock.calls.length, projected["0x2"].mock.calls.length]).toEqual([1, 0]);
    diff([row("shared")]);
    diff([], [{ key: "0x9", model: "TileOpt" }]);
    expect([projected["0x1"].mock.calls.length, projected["0x2"].mock.calls.length]).toEqual([3, 2]);
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
