import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  beginClientActionLatency,
  clearClientActionLatency,
  recordClientActionPreConfirmed,
  recordClientActionDiffReceived,
  recordClientActionPhase,
  recordClientActionStoreApplied,
  recordClientActionRendered,
  recordClientActionSendStage,
  recordAdmissionToVisible,
  recordClientActionSubmitted,
  snapshotClientActionLatency,
  summarizeClientActionLatency,
} from "./client-action-latency";

describe("client action latency", () => {
  beforeEach(() => {
    clearClientActionLatency();
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce(40)
      .mockReturnValueOnce(45)
      .mockReturnValueOnce(50)
      .mockReturnValueOnce(60);
  });

  it("records submit, stream, native store, and rendered action phases", () => {
    const actionId = beginClientActionLatency({ operation: "explore_reveal", surface: "worldmap" });
    recordClientActionPhase(actionId, "calls_built");
    recordClientActionSubmitted(actionId, "0x0abc");
    recordClientActionPreConfirmed("0xabc");
    recordClientActionDiffReceived("0xabc");
    recordClientActionStoreApplied("0xabc");
    recordClientActionRendered(actionId);

    expect(snapshotClientActionLatency()).toEqual([
      expect.objectContaining({
        actionId,
        operation: "explore_reveal",
        transactionHash: "0x0abc",
        phases: {
          click: 10,
          calls_built: 20,
          submitted: 30,
          pre_confirmed: 40,
          diff_received: 45,
          store_applied: 50,
          rendered: 60,
        },
      }),
    ]);
    expect(summarizeClientActionLatency("explore_reveal")).toMatchObject({
      completed: 1,
      p50ClickToRenderedMs: 50,
      p95ClickToRenderedMs: 50,
      p50PreConfirmedToRenderedMs: 20,
      p95PreConfirmedToRenderedMs: 20,
    });
  });

  it("publishes every action's admission-to-visible sample for the gates to read", () => {
    recordAdmissionToVisible(120);
    recordAdmissionToVisible(148);
    expect((globalThis as { __admissionToVisibleMs?: number[] }).__admissionToVisibleMs).toEqual([120, 148]);
    clearClientActionLatency();
    expect((globalThis as { __admissionToVisibleMs?: number[] }).__admissionToVisibleMs).toEqual([]);
  });
});

describe("an action's send, as the game client reports its stages", () => {
  let clock = 0;
  const at = (ms: number) => (clock = ms);
  const sendOf = (actionId: string) =>
    snapshotClientActionLatency()
      .find((record) => record.actionId === actionId)
      ?.send?.stages.map(({ stage, at, detail }) => [stage, at, detail ?? ""].join(" "));

  beforeEach(() => {
    vi.restoreAllMocks();
    clearClientActionLatency();
    vi.spyOn(performance, "now").mockImplementation(() => clock);
  });

  it("joins two overlapping actions each to its own send by hash, and keeps their stream phases apart", () => {
    at(100);
    const move = beginClientActionLatency({ operation: "army_move", surface: "worldmap" });
    at(110);
    const explore = beginClientActionLatency({ operation: "explore_reveal", surface: "worldmap" });
    at(120);
    recordClientActionSendStage("1:1", "command");
    recordClientActionSendStage("1:2", "command");
    at(130);
    recordClientActionSendStage("1:2", "nonce", "known", "0x0b");
    recordClientActionSendStage("1:1", "nonce", "read", "0x0a");
    at(300);
    recordClientActionSendStage("1:2", "answered", "proxy", "0xb");
    recordClientActionSubmitted(explore, "0xb");
    at(320);
    recordClientActionSendStage("1:1", "answered", "herald", "0xa");
    recordClientActionSubmitted(move, "0xa");
    at(340);
    recordClientActionPreConfirmed("0x0a");
    recordClientActionSendStage("1:1", "included", "herald", "0xa");
    recordClientActionSendStage("1:1", "settled", undefined, "0xa");

    expect(snapshotClientActionLatency().map((record) => record.actionId)).toEqual([move, explore]);
    expect(sendOf(move)).toEqual([
      "command 120 ",
      "nonce 130 read",
      "answered 320 herald",
      "included 340 herald",
      "settled 340 ",
    ]);
    expect(sendOf(explore)).toEqual(["command 120 ", "nonce 130 known", "answered 300 proxy"]);
    expect(snapshotClientActionLatency().map((record) => record.phases)).toEqual([
      { click: 100, submitted: 320, pre_confirmed: 340 },
      { click: 110, submitted: 300 },
    ]);
  });

  it("keeps a send no action claimed as its own record, hash and stream phases included", () => {
    at(5);
    recordClientActionSendStage("2:7", "command");
    recordClientActionSendStage("2:7", "nonce", "known", "0xc");
    at(9);
    recordClientActionDiffReceived("0xc");

    expect(snapshotClientActionLatency()).toEqual([
      {
        actionId: "send:2:7",
        operation: "send",
        surface: "unattributed",
        transactionHash: "0xc",
        phases: { diff_received: 9 },
        send: {
          key: "2:7",
          stages: [
            { stage: "command", at: 5 },
            { stage: "nonce", at: 5, detail: "known" },
          ],
        },
      },
    ]);
  });

  it("keeps each stage once, and drops the stages of a send it has already let go", () => {
    for (let send = 1; send <= 401; send += 1) recordClientActionSendStage(`1:${send}`, "command");
    recordClientActionSendStage("1:2", "settled");
    recordClientActionSendStage("1:2", "settled", "TransactionNotSentError");
    recordClientActionSendStage("1:1", "settled");

    const kept = snapshotClientActionLatency();
    expect(kept.map((record) => record.send?.key)).toEqual(Array.from({ length: 400 }, (_, index) => `1:${index + 2}`));
    expect(kept[0]?.send?.stages.map(({ stage, detail }) => [stage, detail])).toEqual([
      ["command", undefined],
      ["settled", undefined],
    ]);
  });
});
