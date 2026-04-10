// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GAME_ENTRY_TIMELINE_EVENT_NAME,
  markGameEntryMilestone,
  recordGameEntryDuration,
  startGameEntryTimeline,
} from "./game-entry-timeline";

describe("game-entry-timeline", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        performance,
      }),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("starts a fresh timeline with the modal-opened milestone", () => {
    startGameEntryTimeline();

    const timeline = (window as Window & typeof globalThis & { __eternumGameEntryTimeline?: Array<{ name: string }> })
      .__eternumGameEntryTimeline;

    expect(timeline).toEqual([
      { elapsedMs: expect.any(Number), name: "modal-opened", timestamp: expect.any(Number) },
      { elapsedMs: expect.any(Number), name: "entry-requested", timestamp: expect.any(Number) },
    ]);
  });

  it("records milestones and emits a browser event", () => {
    const events: Array<{ detail: { name: string } }> = [];
    window.addEventListener(GAME_ENTRY_TIMELINE_EVENT_NAME, (event) => {
      events.push(event as CustomEvent<{ name: string }>);
    });

    startGameEntryTimeline();
    markGameEntryMilestone("bootstrap-started");

    const timeline = (window as Window & typeof globalThis & { __eternumGameEntryTimeline?: Array<{ name: string }> })
      .__eternumGameEntryTimeline;

    expect(timeline?.map((entry) => entry.name)).toEqual(["modal-opened", "entry-requested", "bootstrap-started"]);
    expect(events.at(-1)?.detail.name).toBe("bootstrap-started");
  });

  it("ignores duplicate milestones within the same entry flow", () => {
    startGameEntryTimeline();
    markGameEntryMilestone("bootstrap-started");
    markGameEntryMilestone("bootstrap-started");

    const timeline = (window as Window & typeof globalThis & { __eternumGameEntryTimeline?: Array<{ name: string }> })
      .__eternumGameEntryTimeline;

    expect(timeline?.map((entry) => entry.name)).toEqual(["modal-opened", "entry-requested", "bootstrap-started"]);
  });

  it("records named durations for later inspection", () => {
    startGameEntryTimeline();
    recordGameEntryDuration("initial-sync", 1234);

    const durations = (window as Window & typeof globalThis & { __eternumGameEntryDurations?: Record<string, number> })
      .__eternumGameEntryDurations;

    expect(durations).toEqual({ "initial-sync": 1234 });
  });
});
