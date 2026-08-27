import { describe, expect, it } from "vitest";

import { GameStreamHub, type StreamSocket } from "./game-stream";
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
    expect(socket.messages.every(({ epoch }) => epoch === "epoch-a")).toBe(true);
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
    hub.resume(resumed, { epoch: "epoch-a", seq: 1, type: "resume" });
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
    restartedHub.resume(restarted, { epoch: "epoch-a", seq: 2, type: "resume" });
    expect(restartedSocket.messages.map(({ type }) => type)).toEqual(["hello", "snapshot", "snapshot_end"]);
    expect(restartedSocket.messages.every(({ epoch }) => epoch === "epoch-b")).toBe(true);
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
});
