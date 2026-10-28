import { describe, expect, it } from "vitest";

import { clickToResultTable, framesBetween, measureClickToResult } from "./click-latency.mjs";

/** A frame every 16 ms from 0 to `until`, each frame's callback running as it begins. */
const framesTo = (until, every = 16) => {
  const frames = Array.from({ length: Math.floor(until / every) + 1 }, (_, index) => index * every);
  return { frames, frameRuns: frames };
};

/** A send the client reported, stage by stage, with the facts Herald brought for it. */
const send = ({ command, answered, diff, applied, rendered }) => ({
  operation: "send",
  surface: "unattributed",
  transactionHash: "0xabc",
  phases: { diff_received: diff, store_applied: applied, ...(rendered ? { rendered } : {}) },
  send: {
    key: "1:1",
    stages: [
      { stage: "command", at: command },
      { stage: "answered", at: answered },
    ],
  },
});

describe("measureClickToResult", () => {
  it("cuts a press to its first painted result at each mark the client recorded", () => {
    const measured = measureClickToResult({
      since: 90,
      probe: {
        inputs: [
          { type: "keydown", t: 95 },
          { type: "pointerdown", t: 100 },
        ],
        ...framesTo(800),
        watched: [{ name: "level", t: 688, at: 700 }],
      },
      actionLatency: { clientActions: [send({ command: 112, answered: 140, diff: 600, applied: 630 })] },
      result: { watch: "level" },
    });

    expect(measured.missing).toEqual([]);
    expect(measured.segments).toEqual({ handled: 12, sent: 28, confirmed: 460, applied: 30, drawn: 74 });
    expect(measured.totalMs).toBe(604);
    expect(measured.frames).toEqual({ covered: true, count: 38, worstMs: 16 });
  });

  it("takes the press just before the command, not an earlier one in the step", () => {
    const measured = measureClickToResult({
      since: 0,
      probe: {
        inputs: [
          { type: "pointerdown", t: 10 },
          { type: "pointerdown", t: 300 },
        ],
        ...framesTo(900),
      },
      actionLatency: { clientActions: [send({ command: 305, answered: 320, diff: 700, applied: 710, rendered: 800 })] },
      result: { rendered: true },
    });

    expect(measured.marks.click).toBe(300);
    expect(measured.totalMs).toBe(500);
  });

  it("times a move to its army starting to walk", () => {
    const measured = measureClickToResult({
      since: 0,
      probe: { inputs: [{ type: "pointerdown", t: 50 }], ...framesTo(600) },
      actionLatency: {
        clientActions: [send({ command: 60, answered: 70, diff: 400, applied: 420 })],
        armyMovement: [
          { phase: "movement_started", entityId: 9, wallTimeMs: 20 },
          { phase: "movement_started", entityId: 201, wallTimeMs: 30 },
          { phase: "movement_started", entityId: 201, wallTimeMs: 450 },
        ],
      },
      result: { walking: 201 },
    });

    expect(measured.marks.visible).toBe(464);
    expect(measured.segments.drawn).toBe(44);
  });

  it("counts a result from when the frame that paints it ran, not from when that frame began", () => {
    // The frame that began at 600 ran its callback at 650, after the work that wrote the facts: it paints the result.
    const measured = measureClickToResult({
      since: 0,
      probe: {
        inputs: [{ type: "pointerdown", t: 100 }],
        frames: [96, 112, 600, 660, 676],
        frameRuns: [97, 113, 650, 661, 677],
        watched: [{ name: "level", t: 600, at: 650 }],
      },
      actionLatency: { clientActions: [send({ command: 110, answered: 120, diff: 590, applied: 640 })] },
      result: { watch: "level" },
    });

    expect(measured.marks.visible).toBe(650);
    expect(measured.segments.drawn).toBe(10);
    expect(measured.frames.worstMs).toBe(488);
  });

  it("names a mark the client never reached and leaves its segments out", () => {
    const measured = measureClickToResult({
      since: 0,
      probe: { inputs: [{ type: "pointerdown", t: 50 }], ...framesTo(600), watched: [] },
      actionLatency: { clientActions: [send({ command: 60, answered: 70, diff: undefined, applied: undefined })] },
      result: { watch: "built" },
    });

    expect(measured.missing).toEqual(["diff", "applied", "visible"]);
    expect(measured.segments).toEqual({ handled: 10, sent: 10 });
    expect(measured.totalMs).toBeNull();
    expect(measured.frames.covered).toBe(false);
  });

  it("finds no click when nothing was pressed in the step", () => {
    expect(
      measureClickToResult({
        since: 100,
        probe: { inputs: [{ type: "pointerdown", t: 50 }], frames: [] },
        actionLatency: { clientActions: [] },
        result: { rendered: true },
      }),
    ).toEqual({ missing: ["click"] });
  });
});

describe("framesBetween", () => {
  it("is not covered when no frame reaches the result", () => {
    // Frames stop at 1022 while the result is at 1500: what the player saw then was never observed.
    expect(framesBetween([990, 1006, 1022], 1000, 1500).covered).toBe(false);
  });

  it("is not covered when no frame starts before the press", () => {
    expect(framesBetween([1010, 1026, 1042], 1000, 1030).covered).toBe(false);
  });

  it("counts the long frame that crosses the result", () => {
    // Frames every 16 ms to 1984, then one at 10000: the result at 2005 waited on that 8 s frame.
    const frames = [...framesTo(1998).frames.filter((frame) => frame >= 990), 10_000];
    expect(framesBetween(frames, 1000, 2005)).toMatchObject({ covered: true, worstMs: 8016 });
  });
});

describe("clickToResultTable", () => {
  const spread = (median, min, max, n = 3) => ({ n, median, min, max });

  it("lays out each timed action's segments and total per mode", () => {
    const table = clickToResultTable({
      "webgpu-auto": {
        steps: {
          "enter-on-map": { durationMs: spread(3000, 3000, 3000) },
          explore: {
            "verdict.clickToResult.totalMs": spread(420, 400, 500),
            "verdict.clickToResult.segments.handled": spread(12, 10, 15),
            "verdict.clickToResult.segments.drawn": spread(90, 80, 130),
          },
        },
      },
    });

    expect(table.split("\n")).toEqual([
      "ms, median (min–max)",
      "",
      "### webgpu-auto",
      "",
      "| action | n | handled | sent | confirmed | applied | drawn | total |",
      "|---|---|---|---|---|---|---|---|",
      "| explore | 3 | 12 (10–15) | – | – | – | 90 (80–130) | 420 (400–500) |",
      "",
    ]);
  });

  it("is empty when no step timed an action", () => {
    expect(clickToResultTable({ "webgpu-auto": { steps: { pan: {} } } })).toBe("");
  });
});
