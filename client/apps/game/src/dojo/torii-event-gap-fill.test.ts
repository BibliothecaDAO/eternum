// @vitest-environment node

import type { Entity as ToriiEntity } from "@dojoengine/torii-wasm/types";
import { describe, expect, it, vi } from "vitest";
import { ToriiEventGapFill } from "./torii-event-gap-fill";

const event = (id: string, timestamp: number): ToriiEntity => ({
  hashed_keys: id,
  models: {
    "s2-BattleEvent": {
      timestamp: { type: "primitive", type_name: "u64", key: false, value: timestamp },
    },
  },
});

describe("ToriiEventGapFill", () => {
  it("establishes a baseline without replaying historical events", async () => {
    const handleEvent = vi.fn();
    const gapFill = new ToriiEventGapFill({
      fetchPage: vi.fn(async () => ({ items: [event("historical", 100)] })),
    });

    await gapFill.establishBaseline();

    expect(gapFill.captureWatermark()).toEqual({ timestamp: 100n });
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it("replays an inclusive gap in chronological order without duplicating the watermark event", async () => {
    const handleEvent = vi.fn();
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [event("baseline", 100)] })
      .mockResolvedValueOnce({
        items: [event("latest", 103), event("middle", 102), event("baseline", 100)],
        nextCursor: "older",
      })
      .mockResolvedValueOnce({ items: [event("older", 99)] });
    const gapFill = new ToriiEventGapFill({ fetchPage });
    await gapFill.establishBaseline();

    const replayed = await gapFill.replaySince(gapFill.captureWatermark(), handleEvent);

    expect(replayed).toBe(2);
    expect(handleEvent.mock.calls.map(([value]) => value.hashed_keys)).toEqual(["middle", "latest"]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("dedupes a replacement-stream event that also appears in the replay page", async () => {
    const handleEvent = vi.fn();
    const replacementEvent = event("replacement-live", 101);
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [event("baseline", 100)] })
      .mockResolvedValueOnce({ items: [replacementEvent, event("baseline", 100)] });
    const gapFill = new ToriiEventGapFill({ fetchPage });
    await gapFill.establishBaseline();
    const watermark = gapFill.captureWatermark();
    gapFill.handleLiveEvent(replacementEvent, handleEvent);

    const replayed = await gapFill.replaySince(watermark, handleEvent);

    expect(replayed).toBe(0);
    expect(handleEvent).toHaveBeenCalledOnce();
  });
});
